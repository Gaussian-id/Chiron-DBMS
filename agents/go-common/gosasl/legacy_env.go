package gosasl

import ("os"; "strings")

// Compatibility for project-owned Kerberos options; third-party module identity is unchanged.
func projectEnvironment(name string) string {
    if value,exists:=os.LookupEnv(name); exists { return value }
    if strings.HasPrefix(name,"GAUSS_HORIZON_") { return os.Getenv("DBX_"+strings.TrimPrefix(name,"GAUSS_HORIZON_")) }
    return ""
}
