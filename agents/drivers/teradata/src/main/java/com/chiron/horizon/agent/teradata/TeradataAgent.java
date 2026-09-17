package com.chiron.horizon.agent.teradata;

import com.chiron.horizon.agent.ConfiguredJdbcAgent;
import com.chiron.horizon.agent.JdbcAgentProfile;
import com.chiron.horizon.agent.MultiSessionJsonRpcServer;

public final class TeradataAgent extends ConfiguredJdbcAgent {
    public static final JdbcAgentProfile TERADATA_PROFILE = new JdbcAgentProfile(
        "com.teradata.jdbc.TeraDriver",
        "jdbc:teradata://{host}/DBS_PORT={port},DATABASE={database}",
        1025
    );

    public TeradataAgent() {
        super(TERADATA_PROFILE);
    }

    public static void main(String[] args) {
        new MultiSessionJsonRpcServer(TeradataAgent::new).run();
    }
}
