package com.gauss.horizon.agent.informix;

import com.gauss.horizon.agent.DatabaseAgent;
import com.gauss.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

class InformixAgentExecutionTest extends JdbcFakeExecutionBehaviorTest {
    @Override
    protected DatabaseAgent createAgent() {
        return new InformixAgent();
    }

    @Override
    protected String resultSetSql() {
        return "EXECUTE PROCEDURE sample_proc()";
    }
}
