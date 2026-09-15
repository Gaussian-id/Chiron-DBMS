package com.gauss.horizon.agent.ignite3;

import com.gauss.horizon.agent.DatabaseAgent;
import com.gauss.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

class Ignite3AgentTest extends JdbcFakeExecutionBehaviorTest {
    @Override
    protected DatabaseAgent createAgent() {
        return new Ignite3Agent();
    }

    @Override
    protected String resultSetSql() {
        return "SELECT 1";
    }
}
