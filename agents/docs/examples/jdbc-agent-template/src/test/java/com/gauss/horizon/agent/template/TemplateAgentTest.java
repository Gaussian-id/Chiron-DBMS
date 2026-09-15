package com.gauss.horizon.agent.template;

import com.gauss.horizon.agent.test.TestSupport;
import com.gauss.horizon.agent.ExecuteQueryOptions;
import com.gauss.horizon.agent.test.JdbcAgentFake;
import java.util.List;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

class TemplateAgentTest {
    @Test
    void executeQueryUsesStatementExecute() {
        TemplateAgent agent = new TemplateAgent();
        TestSupport.setPrivateConnection(agent, JdbcAgentFake.connection());

        agent.executeQuery("SHOW TABLES", null, new ExecuteQueryOptions());

        Assertions.assertEquals(
            List.of("setMaxRows:10001", "execute"),
            JdbcAgentFake.calls
        );
    }
}
