package com.gauss.horizon.agent.goldendb;

import com.gauss.horizon.agent.DatabaseAgent;
import com.gauss.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

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
