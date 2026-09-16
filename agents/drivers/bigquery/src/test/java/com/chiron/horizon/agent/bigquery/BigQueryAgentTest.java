package com.chiron.horizon.agent.bigquery;

import com.chiron.horizon.agent.DatabaseAgent;
import com.chiron.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

class BigQueryAgentTest extends JdbcFakeExecutionBehaviorTest {
    @Override
    protected DatabaseAgent createAgent() {
        return new BigQueryAgent();
    }

    @Override
    protected String resultSetSql() {
        return "CALL dataset.proc()";
    }
}
