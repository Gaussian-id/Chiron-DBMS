package com.chiron.horizon.agent.sundb;

import com.chiron.horizon.agent.DatabaseAgent;
import com.chiron.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

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
