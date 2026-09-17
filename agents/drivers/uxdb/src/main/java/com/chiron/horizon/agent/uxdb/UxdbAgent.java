package com.chiron.horizon.agent.uxdb;

import com.chiron.horizon.agent.MultiSessionJsonRpcServer;
import com.chiron.horizon.agent.PostgresLikeAgent;
import com.chiron.horizon.agent.PostgresLikeAgentProfile;

public final class UxdbAgent extends PostgresLikeAgent {
    public static final PostgresLikeAgentProfile UXDB_PROFILE = new PostgresLikeAgentProfile(
        "com.uxsino.uxdb.Driver",
        "jdbc:uxdb://{host}:{port}/{database}",
        52025,
        "ux_catalog",
        "ux_"
    );

    public UxdbAgent() {
        super(UXDB_PROFILE);
    }

    public static void main(String[] args) {
        new MultiSessionJsonRpcServer(UxdbAgent::new).run();
    }
}
