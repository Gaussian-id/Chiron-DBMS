package main

import (
	"encoding/json"
	"log"
	"sync"

	chiron-horizonpluginsdk "github.com/Gaussian-id/Chiron-DBMS/plugins/sdk/go/chiron-horizon-plugin-sdk"
)

type plugin struct {
	mutex       sync.Mutex
	connections map[string]struct{}
}

func (plugin *plugin) Handle(
	_ chiron-horizonpluginsdk.RequestContext,
	method string,
	params json.RawMessage,
	_ *chiron-horizonpluginsdk.Emitter,
) (any, *chiron-horizonpluginsdk.PluginError) {
	var values map[string]any
	if err := json.Unmarshal(params, &values); err != nil {
		return nil, chiron-horizonpluginsdk.NewError(-32602, "Invalid request parameters")
	}
	switch method {
	case "connection/test":
		connection, _ := values["connection"].(map[string]any)
		return map[string]any{"success": true, "message": "{{PLUGIN_NAME_GO}} is ready", "connection": connection}, nil
	case "connection/connect":
		connectionID, pluginError := requestConnectionID(values)
		if pluginError != nil {
			return nil, pluginError
		}
		plugin.mutex.Lock()
		plugin.connections[connectionID] = struct{}{}
		plugin.mutex.Unlock()
		return map[string]any{"success": true}, nil
	case "connection/disconnect":
		connectionID, pluginError := requestConnectionID(values)
		if pluginError != nil {
			return nil, pluginError
		}
		plugin.mutex.Lock()
		delete(plugin.connections, connectionID)
		plugin.mutex.Unlock()
		return map[string]any{"success": true}, nil
	case "{{METHOD_PREFIX}}/ping":
		return map[string]any{"ok": true, "plugin": "{{PLUGIN_ID}}", "language": "go", "connectionId": values["connectionId"]}, nil
	default:
		return nil, chiron-horizonpluginsdk.MethodNotFound(method)
	}
}

func requestConnectionID(values map[string]any) (string, *chiron-horizonpluginsdk.PluginError) {
	connection, _ := values["connection"].(map[string]any)
	connectionID, _ := connection["id"].(string)
	if connectionID == "" {
		return "", chiron-horizonpluginsdk.NewError(-32602, "Missing connection id")
	}
	return connectionID, nil
}

func main() {
	metadata := chiron-horizonpluginsdk.Metadata{
		ID:           "{{PLUGIN_ID}}",
		Version:      "{{VERSION}}",
		Capabilities: []string{"connections"},
	}
	server := chiron-horizonpluginsdk.NewServer(metadata, &plugin{connections: map[string]struct{}{}})
	if err := server.Serve(); err != nil {
		log.Fatal(err)
	}
}
