package com.gauss.horizon.agent.highgo;

import com.gauss.horizon.agent.MultiSessionJsonRpcServer;
import com.gauss.horizon.agent.PostgresLikeAgent;
import com.gauss.horizon.agent.PostgresLikeAgentProfile;

public final class HighgoAgent extends PostgresLikeAgent {
    public static final PostgresLikeAgentProfile HIGHGO_PROFILE = new PostgresLikeAgentProfile(
        "com.highgo.jdbc.Driver",
        "jdbc:highgo://{host}:{port}/{database}"
    );

    public HighgoAgent() {
        super(HIGHGO_PROFILE);
    }

    @Override
    public String setSchemaSQL(String schema) {
        if ("public".equals(schema)) {
            return super.setSchemaSQL(schema);
        }
        return super.setSchemaSQL(schema) + ", public";
    }

    public static void main(String[] args) {
        new MultiSessionJsonRpcServer(HighgoAgent::new).run();
    }
}
