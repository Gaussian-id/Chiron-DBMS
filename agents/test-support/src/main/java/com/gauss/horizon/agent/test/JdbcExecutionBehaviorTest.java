package com.gauss.horizon.agent.test;

import com.gauss.horizon.agent.DatabaseAgent;
import com.gauss.horizon.agent.ExecuteQueryOptions;
import com.gauss.horizon.agent.JdbcExecutor;
import com.gauss.horizon.agent.QueryPageOptions;
import com.gauss.horizon.agent.QueryPageResult;
import com.gauss.horizon.agent.QueryResult;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

public abstract class JdbcExecutionBehaviorTest extends JdbcConnectedAgentTest {
    protected abstract String resultSetSql();

    protected abstract List<String> expectedResultSetColumns();

    protected abstract List<List<Object>> expectedResultSetRows();

    protected abstract String rowsSql(int rowCount);

    @Test
    void executesStatementsThatReturnResultSetsWithoutSelectPrefix() {
        withAgent("gauss-horizon-agent-result-set", agent -> {
            QueryResult result = agent.executeQuery(resultSetSql(), null, new ExecuteQueryOptions());

            assertEquals(expectedResultSetColumns(), result.getColumns());
            assertEquals(expectedResultSetRows(), result.getRows());
            assertEquals(0, result.getAffected_rows());
            assertFalse(result.getTruncated());
        });
    }

    @Test
    void doesNotMarkExactlyMaxRowsAsTruncated() {
        withAgent("gauss-horizon-agent-limit", agent -> {
            QueryResult result = agent.executeQuery(rowsSql(JdbcExecutor.DEFAULT_MAX_ROWS), null, new ExecuteQueryOptions());

            assertEquals(JdbcExecutor.DEFAULT_MAX_ROWS, result.getRows().size());
            assertFalse(result.getTruncated());
        });
    }

    @Test
    void marksResultsBeyondMaxRowsAsTruncated() {
        withAgent("gauss-horizon-agent-truncated", agent -> {
            QueryResult result = agent.executeQuery(rowsSql(JdbcExecutor.DEFAULT_MAX_ROWS + 1), null, new ExecuteQueryOptions());

            assertEquals(JdbcExecutor.DEFAULT_MAX_ROWS, result.getRows().size());
            assertTrue(result.getTruncated());
        });
    }

    @Test
    void fetchesSubsequentResultPagesFromTheSameJdbcSession() {
        withAgent("gauss-horizon-agent-session-pages", agent -> {
            QueryPageResult first = agent.executeQueryPage(rowsSql(5), null, new QueryPageOptions(2, 2, 10));

            assertEquals(Arrays.asList(Collections.singletonList(1L), Collections.singletonList(2L)), first.getRows());
            assertTrue(first.getHas_more());
            assertFalse(first.getTruncated());
            String sessionId = first.getSession_id();
            assertNotNull(sessionId);

            QueryPageResult second = agent.fetchQueryPage(sessionId, 2);

            assertEquals(Arrays.asList(Collections.singletonList(3L), Collections.singletonList(4L)), second.getRows());
            assertTrue(second.getHas_more());
            assertFalse(second.getTruncated());

            QueryPageResult third = agent.fetchQueryPage(sessionId, 2);

            assertEquals(Collections.singletonList(Collections.singletonList(5L)), third.getRows());
            assertFalse(third.getHas_more());
            assertFalse(third.getTruncated());
        });
    }

    @Test
    void fetchesTableReadPagesFromTheSameJdbcSession() {
        withAgent("gauss-horizon-agent-table-read-session-pages", agent -> {
            QueryPageResult first = agent.startTableRead(rowsSql(5), null, new QueryPageOptions(2, 2, 10));

            assertEquals(Arrays.asList(Collections.singletonList(1L), Collections.singletonList(2L)), first.getRows());
            assertTrue(first.getHas_more());
            assertFalse(first.getTruncated());
            String sessionId = first.getSession_id();
            assertNotNull(sessionId);

            QueryPageResult second = agent.fetchTableReadPage(sessionId, 2);

            assertEquals(Arrays.asList(Collections.singletonList(3L), Collections.singletonList(4L)), second.getRows());
            assertTrue(second.getHas_more());
            assertFalse(second.getTruncated());

            QueryPageResult third = agent.fetchTableReadPage(sessionId, 2);

            assertEquals(Collections.singletonList(Collections.singletonList(5L)), third.getRows());
            assertFalse(third.getHas_more());
            assertFalse(third.getTruncated());
            assertFalse(agent.closeTableReadSession(sessionId));
        });
    }

    @Test
    void closesJdbcResultSessionsExplicitly() {
        withAgent("gauss-horizon-agent-session-close", agent -> {
            QueryPageResult first = agent.executeQueryPage(rowsSql(5), null, new QueryPageOptions(2, 2, 10));
            String sessionId = first.getSession_id();
            assertNotNull(sessionId);

            assertTrue(agent.closeQuerySession(sessionId));
            assertFalse(agent.closeQuerySession(sessionId));
            assertThrows(IllegalArgumentException.class, () -> agent.fetchQueryPage(sessionId, 2));
        });
    }

    @Test
    void expiresIdleJdbcResultSessions() {
        withAgent("gauss-horizon-agent-session-expiry", agent -> {
            QueryPageResult first = agent.executeQueryPage(rowsSql(5), null, new QueryPageOptions(2, 2, 10));
            String sessionId = first.getSession_id();
            assertNotNull(sessionId);

            assertEquals(1, JdbcExecutor.INSTANCE.expireIdleQuerySessions(System.currentTimeMillis(), 0L));
            assertThrows(IllegalArgumentException.class, () -> agent.fetchQueryPage(sessionId, 2));
        });
    }

    @Test
    void handlesTransactionControlStatementsConsistently() {
        withAgent("gauss-horizon-agent-transaction", agent -> {
            Connection connection = agent.getConnection();
            assertNotNull(connection);

            try {
                QueryResult begin = agent.executeQuery("BEGIN", null, new ExecuteQueryOptions());
                assertFalse(connection.getAutoCommit());
                assertEquals(Collections.emptyList(), begin.getColumns());
                assertEquals(Collections.emptyList(), begin.getRows());
                assertEquals(0, begin.getAffected_rows());
                assertFalse(begin.getTruncated());

                QueryResult commit = agent.executeQuery("COMMIT", null, new ExecuteQueryOptions());
                assertTrue(connection.getAutoCommit());
                assertEquals(Collections.emptyList(), commit.getColumns());
                assertEquals(Collections.emptyList(), commit.getRows());
                assertEquals(0, commit.getAffected_rows());
                assertFalse(commit.getTruncated());

                agent.executeQuery("BEGIN", null, new ExecuteQueryOptions());
                assertFalse(connection.getAutoCommit());

                QueryResult rollback = agent.executeQuery("ROLLBACK", null, new ExecuteQueryOptions());
                assertTrue(connection.getAutoCommit());
                assertEquals(Collections.emptyList(), rollback.getColumns());
                assertEquals(Collections.emptyList(), rollback.getRows());
                assertEquals(0, rollback.getAffected_rows());
                assertFalse(rollback.getTruncated());
            } catch (Exception e) {
                throw new AssertionError(e);
            }
        });
    }
}
