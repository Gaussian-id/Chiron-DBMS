package com.gauss.horizon.agent.kylin;

import com.gauss.horizon.agent.DatabaseAgent;
import com.gauss.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

class KylinAgentTest extends JdbcFakeExecutionBehaviorTest {
    @Override
    protected DatabaseAgent createAgent() {
        return new KylinAgent();
    }

    @Override
    protected String resultSetSql() {
        return "CALL sample_proc()";
    }
}
