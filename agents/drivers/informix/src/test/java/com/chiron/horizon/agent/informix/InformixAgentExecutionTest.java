package com.chiron.horizon.agent.informix;

import com.chiron.horizon.agent.DatabaseAgent;
import com.chiron.horizon.agent.test.JdbcFakeExecutionBehaviorTest;

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
