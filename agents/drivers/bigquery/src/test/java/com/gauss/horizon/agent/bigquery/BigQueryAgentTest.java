package com.gauss.horizon.agent.bigquery;

import com.gauss.horizon.agent.DatabaseAgent;
import com.gauss.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

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
