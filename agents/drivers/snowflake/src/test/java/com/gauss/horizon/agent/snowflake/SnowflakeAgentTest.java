package com.gauss.horizon.agent.snowflake;

import com.gauss.horizon.agent.DatabaseAgent;
import com.gauss.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

class SnowflakeAgentTest extends JdbcFakeExecutionBehaviorTest {
    @Override
    protected DatabaseAgent createAgent() {
        return new SnowflakeAgent();
    }

    @Override
    protected String resultSetSql() {
        return "CALL sample_proc()";
    }
}
