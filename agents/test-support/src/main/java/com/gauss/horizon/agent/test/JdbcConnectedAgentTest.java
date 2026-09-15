package com.gauss.horizon.agent.test;

import com.gauss.horizon.agent.DatabaseAgent;

import java.util.function.Consumer;

public abstract class JdbcConnectedAgentTest {
    protected abstract DatabaseAgent createConnectedAgent(String databaseName);

    protected void withAgent(String databaseName, Consumer<DatabaseAgent> block) {
        DatabaseAgent agent = createConnectedAgent(databaseName);
        try {
            block.accept(agent);
        } finally {
            agent.disconnect();
        }
    }
}
