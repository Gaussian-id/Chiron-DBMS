package com.gauss.horizon.agent.template;

import com.gauss.horizon.agent.ConfiguredJdbcAgent;
import com.gauss.horizon.agent.JdbcAgentProfile;
import com.gauss.horizon.agent.JdbcIdentifiers;
import com.gauss.horizon.agent.MultiSessionJsonRpcServer;

public final class TemplateAgent extends ConfiguredJdbcAgent {
    public static final JdbcAgentProfile TEMPLATE_PROFILE = new JdbcAgentProfile(
        "com.example.jdbc.TemplateDriver",
        "jdbc:template://{host}:{port}/{database}",
        1234
    );

    public TemplateAgent() {
        super(TEMPLATE_PROFILE);
    }

    @Override
    public String setSchemaSQL(String schema) {
        return "SET SCHEMA " + JdbcIdentifiers.INSTANCE.doubleQuote(schema);
    }

    public static void main(String[] args) {
        new MultiSessionJsonRpcServer(TemplateAgent::new).run();
    }
}
