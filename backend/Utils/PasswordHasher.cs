using System.Security.Cryptography;
using System.Text;

namespace Utils;

/// <summary>
/// Password hashing via BCrypt (adaptive cost, salt embedded in the hash — no separate
/// salt column needed for new hashes). Also verifies the legacy SHA-256(password + salt)
/// hex hashes used before this upgrade, so existing accounts keep working while they are
/// migrated to BCrypt on their next successful login (see AuthService.LoginAsync).
/// New hashes are never created with the legacy scheme.
/// </summary>
public static class PasswordHasher
{
    private const int WorkFactor = 12;

    /// <summary>Hash a password with BCrypt. The result embeds its own salt and cost factor.</summary>
    public static string Hash(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, workFactor: WorkFactor);

    /// <summary>True if <paramref name="hash"/> was produced by <see cref="Hash"/> (BCrypt), not the legacy scheme.</summary>
    public static bool IsBCryptHash(string? hash) =>
        !string.IsNullOrEmpty(hash) &&
        (hash.StartsWith("$2a$", StringComparison.Ordinal) ||
         hash.StartsWith("$2b$", StringComparison.Ordinal) ||
         hash.StartsWith("$2y$", StringComparison.Ordinal));

    /// <summary>
    /// Verify a password against a stored hash. Handles both BCrypt hashes and legacy
    /// SHA-256(password + salt) hashes; callers should migrate legacy accounts to BCrypt
    /// once a legacy verification succeeds.
    /// </summary>
    public static bool Verify(string password, string storedHash, string? legacySalt = null)
    {
        if (string.IsNullOrEmpty(storedHash)) return false;

        return IsBCryptHash(storedHash)
            ? BCrypt.Net.BCrypt.Verify(password, storedHash)
            : string.Equals(LegacySha256Hash(password, legacySalt ?? ""), storedHash, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Legacy SHA-256(password + salt) hex hash. Verification only — never used to create new hashes.</summary>
    public static string LegacySha256Hash(string password, string salt)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(password + salt));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
