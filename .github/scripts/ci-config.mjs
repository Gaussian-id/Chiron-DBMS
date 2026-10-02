export const rustGroups = {
  foundation: [
    "chiron-horizon-types", "chiron-horizon-platform", "chiron-horizon-sql-core", "chiron-horizon-sql-dialect", "chiron-horizon-sql-data", "chiron-horizon-sql-schema", "chiron-horizon-sql",
    "chiron-horizon-formats", "chiron-horizon-ai-provider", "chiron-horizon-plugin-runtime",
  ],
  drivers: [
    "chiron-horizon-driver-support", "chiron-horizon-driver-agent", "chiron-horizon-driver-elasticsearch", "chiron-horizon-driver-mongodb",
    "chiron-horizon-driver-mysql", "chiron-horizon-driver-postgres", "chiron-horizon-driver-redis", "chiron-horizon-driver-sqlserver", "chiron-horizon-drivers",
    "chiron-horizon-sqlite-worker",
  ],
  application: ["chiron-horizon", "chiron-horizon-core", "chiron-horizon-web", "chiron-horizon-cli", "chiron-horizon-mcp"],
};

export const goAgents = [
  { driver: "oracle-go", binary: "oracle", race: false },
  { driver: "xugu", binary: "xugu", race: false },
  { driver: "rabbitmq", binary: "rabbitmq", race: false },
  { driver: "rocketmq", binary: "rocketmq", race: true },
  { driver: "zookeeper", binary: "zookeeper", race: true },
  { driver: "cassandra-go", binary: "cassandra", race: false },
  { driver: "hive-go", binary: "hive", race: false },
  { driver: "vastbase-go", binary: "vastbase", race: false },
  { driver: "neo4j-go", binary: "neo4j", race: false },
  { driver: "nebula-go", binary: "nebula", race: false },
  { driver: "iotdb", binary: "iotdb", race: false },
];

export const rustAgents = ["duckdb", "tdengine"];

export const integrationCases = [
  ...["3.4.14", "3.5.5", "3.7.0", "3.9.5"].map((version) => ({ driver: "zookeeper", scenario: "zookeeper", version })),
  { driver: "zookeeper", scenario: "zookeeper-sasl", version: "3.7.0" },
  ...["4.9.8", "5.3.1"].map((version) => ({ driver: "rocketmq", scenario: "rocketmq", version })),
  ...["2.4.0.14", "2.6.0.34", "3.0.7.1", "3.3.6.13", "3.4.2.2"].map((version) => ({
    driver: "tdengine", scenario: "tdengine", version,
    image: `tdengine/${version === "3.4.2.2" ? "tsdb" : "tdengine"}:${version}`,
  })),
  ...["3.11.19", "5.0.6"].map((version) => ({ driver: "cassandra-go", scenario: "cassandra", version })),
  ...["3.13", "4.3"].map((version) => ({ driver: "rabbitmq", scenario: "rabbitmq", version })),
];
