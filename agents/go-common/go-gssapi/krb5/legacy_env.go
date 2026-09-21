package krb5

import ("os"; "strings")

// Compatibility for project-owned Kerberos options; third-party module identity is unchanged.
func projectEnvironment(name string) string {
    if value,exists:=os.LookupEnv(name); exists { return value }
    if strings.HasPrefix(name,"CHIRON_HORIZON_") { return os.Getenv("CHIRON_HORIZON_"+strings.TrimPrefix(name,"CHIRON_HORIZON_")) }
    return ""
}
