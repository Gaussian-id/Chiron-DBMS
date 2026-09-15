#!/usr/bin/env python3
"""Real MongoDB + standalone MCP stdio/HTTP acceptance. Only disposable data.
Run after building gauss-horizon-mcp; requires Docker and Python 3 standard library.
Evidence survives; only the container created by this run is removed on exit.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import queue
import secrets
import socket
import sqlite3
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request


def command(*args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True, **kwargs).stdout.strip()


class StdioClient:
    def __init__(self, binary, env, log):
        self.err = open(log, 'w')
        self.proc = subprocess.Popen([str(binary), '--stdio'], env=env, stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=self.err, text=True, bufsize=1)
        self.responses = queue.Queue()
        self.next_id = 0
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        for line in self.proc.stdout:
            try:
                self.responses.put(json.loads(line))
            except Exception as error:
                self.responses.put({'invalid_stdout': str(error)})
        self.responses.put({'eof': self.proc.poll()})

    def call(self, method, params=None):
        self.next_id += 1
        request = {'jsonrpc': '2.0', 'id': self.next_id, 'method': method}
        if params is not None:
            request['params'] = params
        self.proc.stdin.write(json.dumps(request) + '\n')
        self.proc.stdin.flush()
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            response = self.responses.get(timeout=max(.01, deadline-time.monotonic()))
            assert not ('invalid_stdout' in response or 'eof' in response), response
            if response.get('id') == self.next_id:
                assert 'error' not in response, response
                return response['result']
        raise TimeoutError(method)

    def notify(self, method):
        self.proc.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': method}) + '\n')
        self.proc.stdin.flush()

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.close()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.terminate()
                self.proc.wait(timeout=5)
        self.err.close()


class HttpClient:
    def __init__(self, url, token):
        self.url, self.token, self.session, self.next_id = url, token, None, 0

    def request(self, payload, token=None, origin=None):
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
                   'MCP-Protocol-Version': '2025-11-25'}
        if token is not None:
            headers['Authorization'] = 'Bearer ' + token
        if self.session:
            headers['Mcp-Session-Id'] = self.session
        if origin:
            headers['Origin'] = origin
        request = urllib.request.Request(self.url, json.dumps(payload).encode(), headers)
        with urllib.request.urlopen(request, timeout=20) as response:
            self.session = response.headers.get('Mcp-Session-Id', self.session)
            if response.status == 202:
                return None
            if 'text/event-stream' in response.headers.get('Content-Type', ''):
                data = []
                for line in response:
                    if line.startswith(b'data:'):
                        data.append(line[5:].lstrip(b' ').rstrip(b'\r\n'))
                    elif not line.strip():
                        event = b'\n'.join(data)
                        data = []
                        # SSE priming/keep-alive events can have empty data.
                        if event.strip():
                            message = json.loads(event)
                            if message.get('id') == payload.get('id'):
                                return message
                raise AssertionError('SSE ended without response')
            return json.load(response)

    def call(self, method, params=None):
        self.next_id += 1
        response = self.request({'jsonrpc': '2.0', 'id': self.next_id, 'method': method,
                                 'params': params or {}}, self.token)
        assert 'error' not in response, response
        return response['result']

    def notify(self, method):
        self.request({'jsonrpc': '2.0', 'method': method}, self.token)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binary', default='target/debug/gauss-horizon-mcp')
    parser.add_argument('--image', default='mongo:8.0')
    args = parser.parse_args()
    binary = Path(args.binary).resolve()
    assert binary.is_file(), 'Build the standalone MCP binary first'
    evidence = Path(tempfile.mkdtemp(prefix='gauss-horizon-mongo-mcp-'))
    evidence.chmod(0o700)
    profile = evidence/'profile'
    profile.mkdir(mode=0o700)
    mongo_password, http_token = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    envfile = evidence/'mongo.env'
    envfile.touch(mode=0o600)
    envfile.write_text('MONGO_INITDB_ROOT_USERNAME=root\nMONGO_INITDB_ROOT_PASSWORD='+mongo_password+'\n')
    name = 'gauss-horizon-mcp-e2e-'+secrets.token_hex(5)
    # Retain runtime paths only; never inherit another profile/backend configuration.
    runtime_keys = ('PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT',
                    'WINDIR', 'COMSPEC', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'LC_ALL')
    env = {key: os.environ[key] for key in runtime_keys if key in os.environ}
    env['GAUSS_HORIZON_DATA_DIR'] = str(profile)
    checks, transcript, clients = [], [], []
    http_process, container_started, complete = None, False, False
    db = profile/'gauss-horizon.db'

    def passed(label):
        checks.append(label)
        print('PASS:', label, flush=True)

    def initialize(client):
        result = client.call('initialize', {'protocolVersion': '2025-11-25', 'capabilities': {},
                                             'clientInfo': {'name': 'gauss-horizon-mongodb-e2e', 'version': '0.1.0'}})
        assert result['serverInfo']['name'] == 'gauss-horizon' and result['serverInfo']['version'] == '0.1.0', result
        client.notify('notifications/initialized')
        return result

    def start():
        client = StdioClient(binary, env, evidence/f'mcp-{len(clients)}.stderr.log')
        clients.append(client)
        initialize(client)
        return client

    def tool(client, name, arguments=None, error=None):
        result = client.call('tools/call', {'name': 'gauss_horizon_'+name, 'arguments': arguments or {}})
        text = '\n'.join(x.get('text', '') for x in result.get('content', []))
        assert mongo_password not in text and http_token not in text, 'Secret leaked in tool output'
        transcript.append({'tool': name, 'result': result})
        if error:
            assert result.get('isError') and error in text, (name, error, text)
        else:
            assert not result.get('isError'), (name, text)
        return text

    def policy(value):
        with sqlite3.connect(db) as store:
            row = store.execute('SELECT settings_json FROM app_settings WHERE id=1').fetchone()
            settings = json.loads(row[0]) if row else {}
            settings['mcp_global_policy'] = {'readOnly': False, 'allowDangerousSql': False,
                                             'allowedConnectionIds': None, **value}
            store.execute('INSERT OR REPLACE INTO app_settings(id,settings_json) VALUES(1,?)', (json.dumps(settings),))

    def patch_connection(connection_id, **values):
        with sqlite3.connect(db) as store:
            config = json.loads(store.execute('SELECT config_json FROM connections WHERE id=?', (connection_id,)).fetchone()[0])
            config.update(values)
            store.execute('UPDATE connections SET config_json=? WHERE id=?', (json.dumps(config), connection_id))

    def mongo(js):
        auth = 'db.getSiblingDB("admin").auth(process.env.MONGO_INITDB_ROOT_USERNAME,process.env.MONGO_INITDB_ROOT_PASSWORD);'
        return command('docker', 'exec', name, 'mongosh', '--quiet', '--eval', auth+js, timeout=25)

    try:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        command('docker', 'run', '-d', '--name', name, '--label', 'gauss.horizon.test=mcp-mongodb-e2e',
                '-p', f'127.0.0.1:{port}:27017', '--env-file', str(envfile), args.image)
        container_started = True
        assert port == int(command('docker', 'port', name, '27017/tcp').rsplit(':', 1)[1])
        deadline = time.monotonic()+90
        while True:
            try:
                version = mongo('print(db.version());')
                break
            except subprocess.CalledProcessError:
                if time.monotonic() > deadline:
                    raise
                time.sleep(1)
        mongo('''const d=db.getSiblingDB('mcp_e2e');
          d.orders.insertMany([{_id:1,city:'Jakarta',amount:10,title:'kopi ☕'},
          {_id:2,city:'Bandung',amount:20,title:'teh'}, {_id:3,city:'Jakarta',amount:30,title:'roti'}]);
          d.many.insertMany(Array.from({length:130},(_,i)=>({_id:i,marker:'row'+String(i).padStart(3,'0')})));
          db.getSiblingDB('mcp_hidden').private.insertOne({_id:1,value:'out-of-scope'});''')
        (evidence/'environment.json').write_text(json.dumps({'mongodbVersion': version, 'image': args.image,
            'imageId': command('docker', 'inspect', name, '--format', '{{.Image}}'),
            'binary': str(binary), 'binarySha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
            'mongoPort': port, 'profile': str(profile)}, indent=2))
        passed('authenticated disposable MongoDB is ready')
        client = start()
        tools = client.call('tools/list')['tools']
        advertised = {t['name'] for t in tools}
        assert {'gauss_horizon_execute_query','gauss_horizon_list_databases','gauss_horizon_describe_table'} <= advertised
        passed('real standalone stdio initialize and tools/list')
        for conn_name, password in [('Mongo E2E', mongo_password), ('Mongo Bad Auth', 'invalid-e2e-password')]:
            tool(client, 'add_connection', {'name': conn_name, 'db_type': 'mongodb', 'host': '127.0.0.1',
                  'port': port, 'username': 'root', 'password': password, 'database': 'admin'})
        assert 'Mongo E2E' in tool(client, 'list_connections')
        client.close()
        with sqlite3.connect(db) as store:
            ids = {json.loads(config)['name']: ident for ident,config in store.execute('SELECT id,config_json FROM connections')}
        cid, bad_id = ids['Mongo E2E'], ids['Mongo Bad Auth']
        for ident in ids.values():
            patch_connection(ident, database=None, url_params='authSource=admin&serverSelectionTimeoutMS=1500&connectTimeoutMS=1000')
        client = start()
        base = {'connection_id': cid, 'database': 'mcp_e2e'}
        def query(sql, error=None, conn=client):
            return tool(conn, 'execute_query', {**base, 'sql': sql}, error)
        databases = tool(client, 'list_databases', {'connection_id': cid})
        assert 'mcp_e2e' in databases and 'mcp_hidden' in databases
        passed('saved credentials survive MCP restart; cold database discovery without default database')
        assert 'orders' in tool(client, 'list_tables', base)
        assert tool(client, 'describe_table', {**base, 'table': 'orders'}) == 'No columns found.'
        assert 'orders' in tool(client, 'get_schema_context', {**base, 'tables': ['orders']})
        passed('collection discovery and schema context; MongoDB does not expose inferred SQL columns')
        read = query('db.orders.find({city:"Jakarta"}).sort({_id:1}).limit(10)')
        assert 'kopi' in read and '☕' in read and 'Bandung' not in read
        assert 'teh' in query('db.orders.findOne({_id:2})')
        assert '3' in query('db.orders.countDocuments({})')
        aggregate = query('db.orders.aggregate([{$group:{_id:"$city",total:{$sum:"$amount"}}}])')
        assert 'Jakarta' in aggregate and '40' in aggregate and 'Bandung' in aggregate
        limited = query('db.many.find({}).sort({_id:1}).limit(130)')
        assert 'row099' in limited and 'row100' not in limited and 'row129' not in limited
        passed('find/filter/sort, findOne, count, aggregate, Unicode and 100-row response bound')
        query('db.orders.find(', 'QUERY_ERROR')
        query('db.runCommand({ping:1})', 'SQL_BLOCKED')
        assert '3' in query('db.orders.countDocuments({})')
        passed('malformed/unsupported commands return tool errors; next request still succeeds')
        query('db.orders.insertOne({_id:4,city:"Solo",amount:50})')
        assert 'Solo' in query('db.orders.findOne({_id:4})')
        query('db.orders.updateOne({_id:4},{$set:{amount:55}})')
        assert '55' in query('db.orders.findOne({_id:4})')
        query('db.orders.deleteOne({_id:4})')
        assert mongo('print(db.getSiblingDB("mcp_e2e").orders.countDocuments({_id:4}));').endswith('0')
        query('db.orders.deleteMany({})', 'SQL_BLOCKED')
        query('db.orders.drop()', 'SQL_BLOCKED')
        assert mongo('print(db.getSiblingDB("mcp_e2e").orders.countDocuments({}));').endswith('3')
        passed('permitted insert/update/filtered delete verified in MongoDB; dangerous operations blocked')
        tool(client, 'list_databases', {'connection_id': bad_id}, 'DATABASE_LIST_ERROR')
        assert '3' in query('db.orders.countDocuments({})')
        passed('bad MongoDB credentials fail without affecting valid connection')
        client.close()
        policy({'readOnly': True, 'allowedConnectionIds': [cid], 'connectionPolicies': [
            {'connectionId': cid, 'databaseScope': 'selected', 'allowedDatabases': ['mcp_e2e'], 'readOnly': True}]})
        client = start()
        def query_ro(sql, error=None):
            return tool(client, 'execute_query', {**base, 'sql': sql}, error)
        assert 'Mongo Bad Auth' not in tool(client, 'list_connections')
        assert tool(client, 'list_databases', {'connection_id': cid}) == '- mcp_e2e'
        tool(client, 'execute_query', {**base, 'connection_id': bad_id, 'sql': 'db.orders.find({})'}, 'CONNECTION_OUT_OF_SCOPE')
        tool(client, 'execute_query', {**base, 'database': 'mcp_hidden', 'sql': 'db.private.find({})'}, 'DATABASE_OUT_OF_SCOPE')
        query_ro('db.orders.insertOne({_id:99})', 'MCP_READ_ONLY')
        query_ro('db.orders.updateOne({_id:1},{$set:{amount:999}})', 'MCP_READ_ONLY')
        query_ro('db.orders.deleteOne({_id:1})', 'MCP_READ_ONLY')
        query_ro('db.orders.aggregate([{$out:{db:"mcp_hidden",coll:"leaked"}}])', 'DATABASE_OUT_OF_SCOPE')
        assert mongo('print(db.getSiblingDB("mcp_e2e").orders.findOne({_id:1}).amount);').endswith('10')
        assert mongo('print(db.getSiblingDB("mcp_hidden").getCollectionNames().includes("leaked"));').endswith('false')
        passed('read-only, connection/database scope and cross-database aggregation restrictions; no side effects')
        client.close()
        policy({})
        patch_connection(cid, is_production=True)
        client = start()
        tool(client, 'execute_query', {**base, 'sql': 'db.orders.insertOne({_id:100})'}, 'PRODUCTION_WRITE_BLOCKED')
        passed('production connection rejects writes even with writable MCP policy')
        client.close()
        patch_connection(cid, is_production=False)
        policy({'allowedToolNames': ['gauss_horizon_list_connections']})
        client = start()
        assert {t['name'] for t in client.call('tools/list')['tools']} == {'gauss_horizon_list_connections'}
        tool(client, 'execute_query', {**base, 'sql': 'db.orders.find({})'}, 'TOOL_OUT_OF_SCOPE')
        passed('tool allowlist controls discovery and direct invocation')
        client.close()
        policy({'readOnly': True, 'allowedConnectionIds': [cid]})
        client = start()
        command('docker', 'stop', '--time', '2', name)
        tool(client, 'execute_query', {**base, 'sql': 'db.orders.find({})'}, 'QUERY_ERROR')
        command('docker', 'start', name)
        deadline=time.monotonic()+45
        while True:
            try:
                mongo('print(db.version())')
                break
            except subprocess.CalledProcessError:
                assert time.monotonic()<deadline
                time.sleep(1)
        assert port == int(command('docker', 'port', name, '27017/tcp').rsplit(':', 1)[1]), 'Docker changed published endpoint'
        deadline=time.monotonic()+15
        attempts=0
        while True:
            attempts += 1
            recovered=client.call('tools/call', {'name':'gauss_horizon_execute_query','arguments':{**base,'sql':'db.orders.countDocuments({})'}})
            transcript.append({'tool':'read_after_mongodb_restart','result':recovered})
            if not recovered.get('isError'):
                assert '3' in json.dumps(recovered)
                break
            assert time.monotonic()<deadline, recovered
            time.sleep(.5)
        passed(f'MongoDB interruption returns an error and recovers after restart ({attempts} explicit read attempts; no write retries)')
        client.close()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0))
            http_port=sock.getsockname()[1]
        http_env={**env, 'GAUSS_HORIZON_MCP_HTTP_TOKEN': http_token}
        with open(evidence/'http.stderr.log','w') as stderr:
            http_process=subprocess.Popen([str(binary),'--http','--http-port',str(http_port)],env=http_env,stdout=stderr,stderr=stderr)
        http=HttpClient(f'http://127.0.0.1:{http_port}/mcp',http_token)
        deadline=time.monotonic()+30
        while True:
            try:
                with socket.create_connection(('127.0.0.1',http_port),timeout=1):
                    break
            except OSError:
                assert time.monotonic()<deadline and http_process.poll() is None
                time.sleep(.1)
        init={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25','capabilities':{},'clientInfo':{'name':'e2e','version':'1'}}}
        for token,origin,status in [(None,None,401),('wrong',None,401),(http_token,'https://untrusted.invalid',403)]:
            try:
                http.request(init,token,origin)
                raise AssertionError('HTTP unauthorized request unexpectedly succeeded')
            except urllib.error.HTTPError as error:
                assert error.code==status,(error.code,status)
        initialize(http)
        assert 'gauss_horizon_execute_query' in {t['name'] for t in http.call('tools/list')['tools']}
        assert '3' in tool(http, 'execute_query', {**base,'sql':'db.orders.countDocuments({})'})
        tool(http,'execute_query',{**base,'sql':'db.orders.insertOne({_id:101})'},'MCP_READ_ONLY')
        passed('Streamable HTTP initialize/tools/query, bearer auth, Origin validation and read-only enforcement')
        assert mongo('print(db.getSiblingDB("mcp_e2e").orders.countDocuments({}));').endswith('3')
        passed('final direct database verification: original three records preserved')
        complete = True
    finally:
        for client in clients:
            client.close()
        if http_process and http_process.poll() is None:
            http_process.terminate()
            http_process.wait(timeout=10)
        if container_started:
            subprocess.run(['docker','rm','-f','-v',name],capture_output=True)
        (evidence/'transcript.json').write_text(json.dumps(transcript,indent=2,ensure_ascii=False))
        (evidence/'summary.json').write_text(json.dumps({'status':'passed' if complete else 'failed','passed':checks,'count':len(checks)},indent=2))
        print('Evidence:',evidence,flush=True)
    print(f'All {len(checks)} acceptance groups passed.',flush=True)


if __name__ == '__main__':
    main()
