package com.hushh.app.plugins.HushhVault

import android.util.Base64
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.hushh.app.plugins.shared.BackendUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Hushh Vault Plugin - Encryption + Cloud DB Proxy
 * Port of lib/vault/encrypt.ts and iOS HushhVaultPlugin.swift
 *
 * Uses: AES-256-GCM, PBKDF2 with 100,000 iterations
 */
@CapacitorPlugin(name = "HushhVault")
class HushhVaultPlugin : Plugin() {

    private val TAG = "HushhVault"
    
    // Configure OkHttpClient with 30-second timeouts to prevent infinite hangs
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    override fun load() {
        super.load()
        Log.d(TAG, "⚡ [HushhVault] Plugin Loaded")
    }

    // Default Cloud Run backend URL (fallback if not provided by JS layer)
    private val defaultBackendUrl = "https://consent-protocol-1006304528804.us-central1.run.app"
    private val defaultClientVersion = "2.0.0"

    private fun normalizeBackendUrl(raw: String): String {
        return BackendUrl.normalize(raw)
    }

    private fun getBackendUrl(call: PluginCall? = null): String {
        // 1) Per-call override (useful for local testing)
        val callUrl = call?.getString("backendUrl")
        if (!callUrl.isNullOrBlank()) return normalizeBackendUrl(callUrl)

        // 2) Plugin-scoped config from capacitor.config: plugins.HushhVault.backendUrl
        val pluginUrl = bridge.config.getString("plugins.HushhVault.backendUrl")
        if (!pluginUrl.isNullOrBlank()) return normalizeBackendUrl(pluginUrl)

        // 3) Environment (rare on-device)
        val envUrl = System.getenv("NEXT_PUBLIC_BACKEND_URL")
        if (!envUrl.isNullOrBlank()) return normalizeBackendUrl(envUrl)

        // 4) Final fallback
        return normalizeBackendUrl(defaultBackendUrl)
    }

    private fun getClientVersion(call: PluginCall? = null): String {
        val callVersion = call?.getString("clientVersion")
        if (!callVersion.isNullOrBlank()) return callVersion.trim()
        return defaultClientVersion
    }

    // ==================== Derive Key ====================

    @PluginMethod
    fun deriveKey(call: PluginCall) {
        val passphrase = call.getString("passphrase")
        if (passphrase == null) {
            call.reject("Missing required parameter: passphrase")
            return
        }

        val saltString = call.getString("salt")
        val iterations = call.getInt("iterations") ?: 100000

        try {
            // Generate or use provided salt
            val salt = if (saltString != null) {
                hexStringToByteArray(saltString)
            } else {
                ByteArray(32).also { SecureRandom().nextBytes(it) }
            }

            // PBKDF2 key derivation
            val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            val spec = PBEKeySpec(passphrase.toCharArray(), salt, iterations, 256)
            val key = factory.generateSecret(spec)

            val keyHex = key.encoded.toHexString()
            val saltHex = salt.toHexString()

            Log.d(TAG, "✅ [HushhVault] Key derived successfully")

            call.resolve(JSObject().apply {
                put("keyHex", keyHex)
                put("salt", saltHex)
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ [HushhVault] Key derivation failed: ${e.message}")
            call.reject("Key derivation failed: ${e.message}")
        }
    }

    // ==================== Encrypt Data ====================

    @PluginMethod
    fun encryptData(call: PluginCall) {
        val plaintext = call.getString("plaintext")
        val keyHex = call.getString("keyHex")

        if (plaintext == null || keyHex == null) {
            call.reject("Missing required parameters: plaintext, keyHex")
            return
        }

        try {
            val key = hexStringToByteArray(keyHex)
            val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val secretKey = SecretKeySpec(key, "AES")
            val gcmSpec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec)

            val encrypted = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

            // Split ciphertext and tag (last 16 bytes is the auth tag in GCM)
            val ciphertext = encrypted.dropLast(16).toByteArray()
            val tag = encrypted.takeLast(16).toByteArray()

            Log.d(TAG, "✅ [HushhVault] Data encrypted successfully")

            call.resolve(JSObject().apply {
                put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
                put("tag", Base64.encodeToString(tag, Base64.NO_WRAP))
                put("encoding", "base64")
                put("algorithm", "aes-256-gcm")
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ [HushhVault] Encryption failed: ${e.message}")
            call.reject("Encryption failed: ${e.message}")
        }
    }

    // ==================== Decrypt Data ====================

    @PluginMethod
    fun decryptData(call: PluginCall) {
        val payload = call.getObject("payload")
        val keyHex = call.getString("keyHex")

        if (payload == null || keyHex == null) {
            call.reject("Missing required parameters: payload, keyHex")
            return
        }

        try {
            val ciphertextStr = payload.getString("ciphertext")
            val ivStr = payload.getString("iv")
            val tagStr = payload.getString("tag")

            if (ciphertextStr == null || ivStr == null || tagStr == null) {
                call.reject("Invalid payload: missing ciphertext, iv, or tag")
                return
            }

            val key = hexStringToByteArray(keyHex)
            val ciphertext = Base64.decode(ciphertextStr, Base64.DEFAULT)
            val iv = Base64.decode(ivStr, Base64.DEFAULT)
            val tag = Base64.decode(tagStr, Base64.DEFAULT)

            // Combine ciphertext + tag for GCM
            val combined = ciphertext + tag

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val secretKey = SecretKeySpec(key, "AES")
            val gcmSpec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec)

            val decrypted = cipher.doFinal(combined)
            val plaintext = String(decrypted, Charsets.UTF_8)

            Log.d(TAG, "✅ [HushhVault] Data decrypted successfully")

            call.resolve(JSObject().put("plaintext", plaintext))
        } catch (e: Exception) {
            Log.e(TAG, "❌ [HushhVault] Decryption failed: ${e.message}")
            call.reject("Decryption failed: ${e.message}")
        }
    }

    // ==================== Cloud DB Methods ====================

    // ==================== Cloud DB Methods ====================
    // These call Cloud Run backend directly (Python Agent API)

    @PluginMethod
    fun hasVault(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId == null) {
            call.reject("Missing required parameter: userId")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl(call)
        // Use Native Python Backend Route (POST)
        val url = "$backendUrl/db/vault/check"
        
        Log.d(TAG, "🔐 [hasVault] Checking vault for userId: $userId")

        Thread {
            try {
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())

                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val responseCode = response.code
                val body = response.body?.string() ?: "{}"
                
                Log.d(TAG, "🔐 [hasVault] Response code: $responseCode")
                
                // Handle non-200 responses gracefully? 
                // Python API returns 200 with { hasVault: boolean }
                
                if (response.isSuccessful) {
                    val json = JSONObject(body)
                    val exists = json.optBoolean("hasVault", false)
                    activity.runOnUiThread {
                        call.resolve(JSObject().put("exists", exists))
                    }
                } else {
                     activity.runOnUiThread {
                        call.reject("Failed to check vault: HTTP $responseCode")
                    }
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    call.reject("Failed to check vault: ${e.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun getVault(call: PluginCall) {
        val userId = call.getString("userId")
        Log.d(TAG, "⚡ [getVault] Called for userId: $userId")
        
        if (userId == null) {
            call.reject("Missing required parameter: userId")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl(call)
        // Use Native Python Backend Route (POST)
        val url = "$backendUrl/db/vault/get"

        Thread {
            try {
                Log.d(TAG, "⚡ [getVault] Thread started. Building request to $url")
                
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())

                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                    Log.d(TAG, "⚡ [getVault] Added Auth Token")
                }

                Log.d(TAG, "⚡ [getVault] Executing network request...")
                val response = httpClient.newCall(requestBuilder.build()).execute()
                Log.d(TAG, "⚡ [getVault] Response received. Code: ${response.code}")
                
                val body = response.body?.string() ?: "{}"
                
                if (response.isSuccessful) {
                    val json = JSONObject(body)
                    Log.d(TAG, "⚡ [getVault] Parsing success response...")
                    val wrappersJson = json.optJSONArray("wrappers") ?: JSONArray()
                    val wrappers = JSArray()
                    for (index in 0 until wrappersJson.length()) {
                        val raw = wrappersJson.optJSONObject(index) ?: continue
                        val normalized = JSObject().apply {
                            put("method", raw.optString("method", "passphrase"))
                            put("wrapperId", raw.optString("wrapperId", raw.optString("wrapper_id", "default")))
                            put("encryptedVaultKey", raw.optString("encryptedVaultKey", raw.optString("encrypted_vault_key", "")))
                            put("salt", raw.optString("salt", ""))
                            put("iv", raw.optString("iv", ""))
                            val passkeyCredentialId = raw.optString("passkeyCredentialId", raw.optString("passkey_credential_id", ""))
                            if (passkeyCredentialId.isNotBlank() && passkeyCredentialId.lowercase() != "null") {
                                put("passkeyCredentialId", passkeyCredentialId)
                            }
                            val passkeyPrfSalt = raw.optString("passkeyPrfSalt", raw.optString("passkey_prf_salt", ""))
                            if (passkeyPrfSalt.isNotBlank() && passkeyPrfSalt.lowercase() != "null") {
                                put("passkeyPrfSalt", passkeyPrfSalt)
                            }
                            val passkeyRpId = raw.optString("passkeyRpId", raw.optString("passkey_rp_id", ""))
                            if (passkeyRpId.isNotBlank() && passkeyRpId.lowercase() != "null") {
                                put("passkeyRpId", passkeyRpId)
                            }
                            val passkeyProvider = raw.optString("passkeyProvider", raw.optString("passkey_provider", ""))
                            if (passkeyProvider.isNotBlank() && passkeyProvider.lowercase() != "null") {
                                put("passkeyProvider", passkeyProvider)
                            }
                            val passkeyDeviceLabel = raw.optString("passkeyDeviceLabel", raw.optString("passkey_device_label", ""))
                            if (passkeyDeviceLabel.isNotBlank() && passkeyDeviceLabel.lowercase() != "null") {
                                put("passkeyDeviceLabel", passkeyDeviceLabel)
                            }
                            if (!raw.isNull("passkeyLastUsedAt")) {
                                put("passkeyLastUsedAt", raw.optLong("passkeyLastUsedAt"))
                            } else if (!raw.isNull("passkey_last_used_at")) {
                                put("passkeyLastUsedAt", raw.optLong("passkey_last_used_at"))
                            }
                        }
                        wrappers.put(normalized)
                    }
                    val result = JSObject().apply {
                        put("vaultKeyHash", json.optString("vaultKeyHash", ""))
                        put("primaryMethod", json.optString("primaryMethod", "passphrase"))
                        put("primaryWrapperId", json.optString("primaryWrapperId", "default"))
                        put("recoveryEncryptedVaultKey", json.optString("recoveryEncryptedVaultKey", ""))
                        put("recoverySalt", json.optString("recoverySalt", ""))
                        put("recoveryIv", json.optString("recoveryIv", ""))
                        put("wrappers", wrappers)
                    }
                    
                    activity.runOnUiThread {
                        Log.d(TAG, "⚡ [getVault] Resolving promise on UI thread")
                        call.resolve(result)
                    }
                } else {
                    Log.e(TAG, "⚡ [getVault] Server error: ${response.code}")
                    activity.runOnUiThread {
                        call.reject("Failed to get vault: HTTP ${response.code}")
                    }
                }
            } catch (t: Throwable) {
                Log.e(TAG, "⚡ [getVault] CRASH/ERROR: ${t.message}", t)
                activity.runOnUiThread {
                    call.reject("Failed to get vault: ${t.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun setupVault(call: PluginCall) {
        val userId = call.getString("userId")
        val vaultKeyHash = call.getString("vaultKeyHash")
        val primaryMethod = call.getString("primaryMethod")
        val recoveryEncryptedVaultKey = call.getString("recoveryEncryptedVaultKey")
        val recoverySalt = call.getString("recoverySalt")
        val recoveryIv = call.getString("recoveryIv")
        val primaryWrapperId = call.getString("primaryWrapperId") ?: "default"
        val wrappers = call.getArray("wrappers")

        if (userId == null || vaultKeyHash == null || primaryMethod == null || wrappers == null) {
            call.reject("Missing required parameters")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl(call)

        Thread {
            try {
                val normalizedWrappers = JSONArray()
                for (index in 0 until wrappers.length()) {
                    val raw = wrappers.optJSONObject(index) ?: continue
                    val method = raw.optString("method", "passphrase")
                    val encryptedVaultKey =
                        raw.optString("encryptedVaultKey", raw.optString("encrypted_vault_key", ""))
                    val salt = raw.optString("salt", "")
                    val iv = raw.optString("iv", "")
                    if (encryptedVaultKey.isBlank() || salt.isBlank() || iv.isBlank()) continue

                    val normalized = JSONObject().apply {
                        put("method", method)
                        put("wrapperId", raw.optString("wrapperId", raw.optString("wrapper_id", "default")))
                        put("encryptedVaultKey", encryptedVaultKey)
                        put("salt", salt)
                        put("iv", iv)
                        val passkeyCredentialId =
                            raw.optString("passkeyCredentialId", raw.optString("passkey_credential_id", ""))
                        if (passkeyCredentialId.isNotBlank() && passkeyCredentialId.lowercase() != "null") {
                            put("passkeyCredentialId", passkeyCredentialId)
                        }
                        val passkeyPrfSalt =
                            raw.optString("passkeyPrfSalt", raw.optString("passkey_prf_salt", ""))
                        if (passkeyPrfSalt.isNotBlank() && passkeyPrfSalt.lowercase() != "null") {
                            put("passkeyPrfSalt", passkeyPrfSalt)
                        }
                        val passkeyRpId =
                            raw.optString("passkeyRpId", raw.optString("passkey_rp_id", ""))
                        if (passkeyRpId.isNotBlank() && passkeyRpId.lowercase() != "null") {
                            put("passkeyRpId", passkeyRpId)
                        }
                        val passkeyProvider =
                            raw.optString("passkeyProvider", raw.optString("passkey_provider", ""))
                        if (passkeyProvider.isNotBlank() && passkeyProvider.lowercase() != "null") {
                            put("passkeyProvider", passkeyProvider)
                        }
                        val passkeyDeviceLabel =
                            raw.optString("passkeyDeviceLabel", raw.optString("passkey_device_label", ""))
                        if (passkeyDeviceLabel.isNotBlank() && passkeyDeviceLabel.lowercase() != "null") {
                            put("passkeyDeviceLabel", passkeyDeviceLabel)
                        }
                        if (!raw.isNull("passkeyLastUsedAt")) {
                            put("passkeyLastUsedAt", raw.optLong("passkeyLastUsedAt"))
                        } else if (!raw.isNull("passkey_last_used_at")) {
                            put("passkeyLastUsedAt", raw.optLong("passkey_last_used_at"))
                        }
                    }
                    normalizedWrappers.put(normalized)
                }

                val json = JSONObject().apply {
                    put("userId", userId)
                    put("vaultKeyHash", vaultKeyHash)
                    put("primaryMethod", primaryMethod)
                    put("primaryWrapperId", primaryWrapperId)
                    put("recoveryEncryptedVaultKey", recoveryEncryptedVaultKey ?: "")
                    put("recoverySalt", recoverySalt ?: "")
                    put("recoveryIv", recoveryIv ?: "")
                    put("wrappers", normalizedWrappers)
                }

                val requestBody = json.toString().toRequestBody("application/json".toMediaType())
                val requestBuilder = Request.Builder()
                    .url("$backendUrl/db/vault/setup")
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("X-Hushh-Client-Version", getClientVersion(call))

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val success = response.isSuccessful
                val responseBody = response.body?.string().orEmpty()
                val errorSnippet = responseBody.take(300)

                activity.runOnUiThread {
                    if (!success) {
                        val detail = if (errorSnippet.isBlank()) "no response body" else errorSnippet
                        call.reject("Failed to setup vault: HTTP ${response.code} - ${detail}")
                        return@runOnUiThread
                    }
                    call.resolve(JSObject().put("success", true))
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    call.reject("Failed to setup vault: ${e.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun upsertVaultWrapper(call: PluginCall) {
        val userId = call.getString("userId")
        val vaultKeyHash = call.getString("vaultKeyHash")
        val method = call.getString("method")
        val encryptedVaultKey = call.getString("encryptedVaultKey")
        val salt = call.getString("salt")
        val iv = call.getString("iv")

        if (userId == null || vaultKeyHash == null || method == null || encryptedVaultKey == null || salt == null || iv == null) {
            call.reject("Missing required parameters")
            return
        }

        val passkeyCredentialId = call.getString("passkeyCredentialId")
        val passkeyPrfSalt = call.getString("passkeyPrfSalt")
        val passkeyRpId = call.getString("passkeyRpId")
        val passkeyProvider = call.getString("passkeyProvider")
        val passkeyDeviceLabel = call.getString("passkeyDeviceLabel")
        val passkeyLastUsedAt = call.getString("passkeyLastUsedAt")?.toLongOrNull()
            ?: call.getInt("passkeyLastUsedAt")?.toLong()
        val wrapperId = call.getString("wrapperId") ?: "default"
        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl(call)

        Thread {
            try {
                val json = JSONObject().apply {
                    put("userId", userId)
                    put("vaultKeyHash", vaultKeyHash)
                    put("method", method)
                    put("wrapperId", wrapperId)
                    put("encryptedVaultKey", encryptedVaultKey)
                    put("salt", salt)
                    put("iv", iv)
                    if (passkeyCredentialId != null) put("passkeyCredentialId", passkeyCredentialId)
                    if (passkeyPrfSalt != null) put("passkeyPrfSalt", passkeyPrfSalt)
                    if (passkeyRpId != null) put("passkeyRpId", passkeyRpId)
                    if (passkeyProvider != null) put("passkeyProvider", passkeyProvider)
                    if (passkeyDeviceLabel != null) put("passkeyDeviceLabel", passkeyDeviceLabel)
                    if (passkeyLastUsedAt != null) put("passkeyLastUsedAt", passkeyLastUsedAt)
                }

                val requestBody = json.toString().toRequestBody("application/json".toMediaType())
                val requestBuilder = Request.Builder()
                    .url("$backendUrl/db/vault/wrapper/upsert")
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("X-Hushh-Client-Version", getClientVersion(call))

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val success = response.isSuccessful
                val responseBody = response.body?.string().orEmpty()
                val errorSnippet = responseBody.take(300)
                activity.runOnUiThread {
                    if (!success) {
                        val detail = if (errorSnippet.isBlank()) "no response body" else errorSnippet
                        call.reject("Failed to upsert wrapper: HTTP ${response.code} - ${detail}")
                        return@runOnUiThread
                    }
                    call.resolve(JSObject().put("success", true))
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    call.reject("Failed to upsert wrapper: ${e.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun setPrimaryVaultMethod(call: PluginCall) {
        val userId = call.getString("userId")
        val primaryMethod = call.getString("primaryMethod")
        val primaryWrapperId = call.getString("primaryWrapperId") ?: "default"
        if (userId == null || primaryMethod == null) {
            call.reject("Missing required parameters")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl(call)

        Thread {
            try {
                val json = JSONObject().apply {
                    put("userId", userId)
                    put("primaryMethod", primaryMethod)
                    put("primaryWrapperId", primaryWrapperId)
                }
                val requestBody = json.toString().toRequestBody("application/json".toMediaType())
                val requestBuilder = Request.Builder()
                    .url("$backendUrl/db/vault/primary/set")
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("X-Hushh-Client-Version", getClientVersion(call))
                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }
                val response = httpClient.newCall(requestBuilder.build()).execute()
                val success = response.isSuccessful
                val responseBody = response.body?.string().orEmpty()
                val errorSnippet = responseBody.take(300)
                activity.runOnUiThread {
                    if (!success) {
                        val detail = if (errorSnippet.isBlank()) "no response body" else errorSnippet
                        call.reject("Failed to set primary method: HTTP ${response.code} - ${detail}")
                        return@runOnUiThread
                    }
                    call.resolve(JSObject().put("success", true))
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    call.reject("Failed to set primary method: ${e.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun isPasskeyAvailable(call: PluginCall) {
        call.resolve(
            JSObject().apply {
                put("available", false)
                put("reason", "native_passkey_not_implemented")
            }
        )
    }

    @PluginMethod
    fun registerPasskeyPrf(call: PluginCall) {
        call.reject("Native passkey PRF registration is not implemented on Android plugin yet.")
    }

    @PluginMethod
    fun authenticatePasskeyPrf(call: PluginCall) {
        call.reject("Native passkey PRF authentication is not implemented on Android plugin yet.")
    }

    // ==================== Domain Data Methods ====================

    @PluginMethod
    fun getFoodPreferences(call: PluginCall) {
        val userId = call.getString("userId")
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        
        if (userId == null || vaultOwnerToken == null) {
            call.reject("Missing required parameter: userId or vaultOwnerToken")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl(call)
        
        // Use new token-enforced endpoint
        val url = "$backendUrl/api/food/preferences"

        Log.d(TAG, "🍽️ [getFoodPreferences] Fetching with token from: $url")

        Thread {
            try {
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                    put("consentToken", vaultOwnerToken)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
                
                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val responseCode = response.code
                val body = response.body?.string() ?: "{}"
                
                Log.d(TAG, "🍽️ [getFoodPreferences] Response code: $responseCode")

                if (responseCode == 404) {
                    // No food preferences found - return null preferences
                    activity.runOnUiThread {
                        call.resolve(JSObject().apply {
                            put("domain", "food")
                            put("preferences", JSONObject.NULL)
                        })
                    }
                    return@Thread
                }

                if (responseCode != 200) {
                    Log.e(TAG, "❌ [getFoodPreferences] Error: $body")
                    activity.runOnUiThread {
                        call.reject("Failed to get food preferences: HTTP $responseCode")
                    }
                    return@Thread
                }

                val json = JSONObject(body)
                val preferences = json.optJSONObject("preferences")

                activity.runOnUiThread {
                    call.resolve(JSObject().apply {
                        put("domain", "food")
                        put("preferences", preferences ?: JSONObject.NULL)
                    })
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [getFoodPreferences] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Failed to get food preferences: ${e.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun getProfessionalData(call: PluginCall) {
        val userId = call.getString("userId")
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        
        if (userId == null || vaultOwnerToken == null) {
            call.reject("Missing required parameter: userId or vaultOwnerToken")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl(call)
        
        // Use new token-enforced endpoint
        val url = "$backendUrl/api/professional/preferences"

        Log.d(TAG, "💼 [getProfessionalData] Fetching with token from: $url")

        Thread {
            try {
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                    put("consentToken", vaultOwnerToken)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())

                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val responseCode = response.code
                val body = response.body?.string() ?: "{}"
                
                Log.d(TAG, "💼 [getProfessionalData] Response code: $responseCode")

                if (responseCode == 404) {
                    // No professional data found - return null preferences
                    activity.runOnUiThread {
                        call.resolve(JSObject().apply {
                            put("domain", "professional")
                            put("preferences", JSONObject.NULL)
                        })
                    }
                    return@Thread
                }

                if (responseCode != 200) {
                    Log.e(TAG, "❌ [getProfessionalData] Error: $body")
                    activity.runOnUiThread {
                        call.reject("Failed to get professional data: HTTP $responseCode")
                    }
                    return@Thread
                }

                val json = JSONObject(body)
                val preferences = json.optJSONObject("preferences")

                activity.runOnUiThread {
                    call.resolve(JSObject().apply {
                        put("domain", "professional")
                        put("preferences", preferences ?: JSONObject.NULL)
                    })
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [getProfessionalData] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Failed to get professional data: ${e.message}")
                }
            }
        }.start()
    }

    // ==================== Consent Methods ====================
    // Keep using /api/consent/* because we verified these exist on Python backend

    @PluginMethod
    fun getPendingConsents(call: PluginCall) {
        val userId = call.getString("userId")
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        val backendUrl = getBackendUrl(call)
        // Python Backend supports this via /api/consent/pending
        val url = "$backendUrl/api/consent/pending?userId=$userId"

        Thread {
            try {
                val requestBuilder = Request.Builder().url(url).get().addHeader("Content-Type", "application/json")
                if (vaultOwnerToken != null) requestBuilder.addHeader("Authorization", "Bearer $vaultOwnerToken")

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val body = response.body?.string() ?: "{}"
                
                if (response.code == 200) {
                     val json = JSONObject(body)
                     activity.runOnUiThread { call.resolve(JSObject().put("pending", json.optJSONArray("pending"))) }
                } else {
                     activity.runOnUiThread { call.reject("Failed to fetch pending consents: ${response.code}") }
                }
            } catch (e: Exception) {
                activity.runOnUiThread { call.reject("Error: ${e.message}") }
            }
        }.start()
    }

    @PluginMethod
    fun getActiveConsents(call: PluginCall) {
        val userId = call.getString("userId")
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/consent/active?userId=$userId"

        Thread {
            try {
                val requestBuilder = Request.Builder().url(url).get().addHeader("Content-Type", "application/json")
                if (vaultOwnerToken != null) requestBuilder.addHeader("Authorization", "Bearer $vaultOwnerToken")

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val body = response.body?.string() ?: "{}"
                
                if (response.code == 200) {
                     val json = JSONObject(body)
                     activity.runOnUiThread { call.resolve(JSObject().put("active", json.optJSONArray("active"))) }
                } else {
                     activity.runOnUiThread { call.reject("Failed to fetch active consents: ${response.code}") }
                }
            } catch (e: Exception) {
                activity.runOnUiThread { call.reject("Error: ${e.message}") }
            }
        }.start()
    }

    @PluginMethod
    fun getConsentHistory(call: PluginCall) {
        val userId = call.getString("userId")
        val page = call.getInt("page") ?: 1
        val limit = call.getInt("limit") ?: 50
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/consent/history?userId=$userId&page=$page&limit=$limit"

        Thread {
            try {
                val requestBuilder = Request.Builder().url(url).get().addHeader("Content-Type", "application/json")
                if (vaultOwnerToken != null) requestBuilder.addHeader("Authorization", "Bearer $vaultOwnerToken")

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val body = response.body?.string() ?: "{}"
                
                if (response.code == 200) {
                     val json = JSONObject(body)
                     activity.runOnUiThread { call.resolve(JSObject().put("items", json.optJSONArray("items"))) }
                } else {
                     activity.runOnUiThread { call.reject("Failed to fetch consent history: ${response.code}") }
                }
            } catch (e: Exception) {
                activity.runOnUiThread { call.reject("Error: ${e.message}") }
            }
        }.start()
    }

    /**
     * Vault status (domain counts without decrypted data).
     *
     * Backend contract:
     * - Firebase ID token in Authorization header as `authToken`
     * - VAULT_OWNER token in body as `consentToken`
     */
    @PluginMethod
    fun getVaultStatus(call: PluginCall) {
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }
        val vaultOwnerToken = call.getString("vaultOwnerToken") ?: run {
            call.reject("Missing vaultOwnerToken")
            return
        }
        val authToken = call.getString("authToken") ?: run {
            call.reject("Missing authToken")
            return
        }

        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/db/vault/status"

        val json = JSONObject().apply {
            put("userId", userId)
            put("consentToken", vaultOwnerToken)
        }

        val body = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(url)
            .post(body)
            .addHeader("Content-Type", "application/json")
            .addHeader("Authorization", "Bearer $authToken")
            .build()

        val pluginCall = call
        Thread {
            try {
                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string()
                if (!response.isSuccessful || responseBody == null) {
                    activity.runOnUiThread {
                        pluginCall.reject("Failed to fetch vault status: ${response.code}")
                    }
                    return@Thread
                }
                val result = JSObject(responseBody)
                activity.runOnUiThread { pluginCall.resolve(result) }
            } catch (e: Exception) {
                activity.runOnUiThread { pluginCall.reject("Error: ${e.message}") }
            }
        }.start()
    }


    @PluginMethod
    fun storePreferencesToCloud(call: PluginCall) {
        val userId = call.getString("userId")
        val domain = call.getString("domain")
        val fieldName = call.getString("fieldName")
        val ciphertext = call.getString("ciphertext")
        val iv = call.getString("iv")
        val tag = call.getString("tag")
        val consentToken = call.getString("consentToken")
        val backendUrl = getBackendUrl(call)
        val authToken = call.getString("authToken")

        if (userId == null || domain == null || fieldName == null || 
            ciphertext == null || iv == null || tag == null) {
            call.reject("Missing params")
            return
        }

        // Use new token-enforced endpoint
        val url = "$backendUrl/api/$domain/preferences/store"

        Log.d(TAG, "💾 [storePreferencesToCloud] Storing $fieldName with token to: $url")

        Thread {
            try {
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                    put("fieldName", fieldName)
                    put("ciphertext", ciphertext)
                    put("iv", iv)
                    put("tag", tag)
                    if (consentToken != null) put("consentToken", consentToken)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
                
                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody) // Native storage uses POST
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) requestBuilder.addHeader("Authorization", "Bearer $authToken")

                val response = httpClient.newCall(requestBuilder.build()).execute()
                // Python sometimes returns 200 or 201
                val responseCode = response.code
                
                activity.runOnUiThread {
                    if (response.isSuccessful) {
                         call.resolve(JSObject().apply {
                            put("success", true)
                            put("field", fieldName)
                        })
                    } else {
                         call.reject("Failed to store: $responseCode")
                    }
                }
            } catch(e: Exception) {
                 activity.runOnUiThread { call.reject("Error: ${e.message}") }
            }
        }.start()
    }

    // ==================== Preference Storage (Placeholder for SQLCipher) ====================

    @PluginMethod
    fun storePreference(call: PluginCall) {
        // Placeholder - will be implemented with SQLCipher
        call.resolve()
    }

    @PluginMethod
    fun getPreferences(call: PluginCall) {
        // Placeholder - will be implemented with SQLCipher
        call.resolve(JSObject().put("preferences", JSObject()))
    }

    @PluginMethod
    fun deletePreferences(call: PluginCall) {
        // Placeholder - will be implemented with SQLCipher
        call.resolve()
    }

    // ==================== Utility Functions ====================

    private fun ByteArray.toHexString(): String = joinToString("") { "%02x".format(it) }

    private fun hexStringToByteArray(hex: String): ByteArray {
        val result = ByteArray(hex.length / 2)
        for (i in result.indices) {
            result[i] = hex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
        return result
    }
}
