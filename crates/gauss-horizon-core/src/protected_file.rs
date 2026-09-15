//! Restrict files before writing credential material.
use std::path::Path;
pub fn restrict(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = if path.is_dir() { 0o700 } else { 0o600 };
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode))
            .map_err(|e| format!("Cannot protect credential path: {e}"))?;
    }
    #[cfg(windows)]
    {
        use std::{os::windows::ffi::OsStrExt, ptr};
        use windows_sys::Win32::{
            Foundation::LocalFree,
            Security::{
                Authorization::{
                    ConvertStringSecurityDescriptorToSecurityDescriptorW, SetNamedSecurityInfoW, SDDL_REVISION_1,
                    SE_FILE_OBJECT,
                },
                GetSecurityDescriptorDacl, DACL_SECURITY_INFORMATION, PROTECTED_DACL_SECURITY_INFORMATION,
            },
        };
        let sddl: Vec<u16> = "D:P(A;OICI;FA;;;OW)\0".encode_utf16().collect();
        let mut descriptor = ptr::null_mut();
        unsafe {
            if ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                SDDL_REVISION_1,
                &mut descriptor,
                ptr::null_mut(),
            ) == 0
            {
                return Err("Cannot create owner-only credential ACL".into());
            }
            let mut dacl = ptr::null_mut();
            let mut present = 0;
            let mut defaulted = 0;
            if GetSecurityDescriptorDacl(descriptor, &mut present, &mut dacl, &mut defaulted) == 0 || present == 0 {
                LocalFree(descriptor);
                return Err("Cannot inspect credential ACL".into());
            }
            let mut wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
            let code = SetNamedSecurityInfoW(
                wide.as_mut_ptr(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
                ptr::null_mut(),
                ptr::null_mut(),
                dacl,
                ptr::null_mut(),
            );
            LocalFree(descriptor);
            if code != 0 {
                return Err(format!("Cannot protect credential path (Windows error {code})"));
            }
        }
    }
    #[cfg(not(any(unix, windows)))]
    return Err("Credential protection is unsupported on this platform".into());
    Ok(())
}
