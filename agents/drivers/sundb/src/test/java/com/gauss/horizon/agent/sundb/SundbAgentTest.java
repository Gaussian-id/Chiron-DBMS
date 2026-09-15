package com.gauss.horizon.agent.sundb;

import com.gauss.horizon.agent.DatabaseAgent;
import com.gauss.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

class SundbAgentTest extends JdbcFakeExecutionBehaviorTest {
    @Override
    protected DatabaseAgent createAgent() {
        return new SundbAgent();
    }

    @Override
    protected String resultSetSql() {
        return "CALL sample_proc()";
    }
}
