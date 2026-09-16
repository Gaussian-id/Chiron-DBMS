package com.chiron.horizon.agent.ignite3;

import com.chiron.horizon.agent.DatabaseAgent;
import com.chiron.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

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
