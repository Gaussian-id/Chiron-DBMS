package com.chiron.horizon.agent.goldendb;

import com.chiron.horizon.agent.DatabaseAgent;
import com.chiron.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

class GoldendbAgentTest extends JdbcFakeExecutionBehaviorTest {
    @Override
    protected DatabaseAgent createAgent() {
        return new GoldendbAgent();
    }

    @Override
    protected String resultSetSql() {
        return "CALL sample_proc()";
    }
}
