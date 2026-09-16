package com.chiron.horizon.agent.exasol;

import com.chiron.horizon.agent.ConfiguredJdbcAgent;
import com.chiron.horizon.agent.JdbcAgentProfile;
import com.chiron.horizon.agent.MultiSessionJsonRpcServer;

public final class ExasolAgent extends ConfiguredJdbcAgent {
    public static final JdbcAgentProfile EXASOL_PROFILE = new JdbcAgentProfile(
        "com.exasol.jdbc.EXADriver",
        "jdbc:exa:{host}:{port};schema={database}",
        8563,
        true
    );

    public ExasolAgent() {
        super(EXASOL_PROFILE);
    }

    public static void main(String[] args) {
        new MultiSessionJsonRpcServer(ExasolAgent::new).run();
    }
}
