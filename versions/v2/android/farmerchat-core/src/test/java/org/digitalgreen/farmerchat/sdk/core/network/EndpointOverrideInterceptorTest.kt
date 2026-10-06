package org.digitalgreen.farmerchat.sdk.core.network

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test

class EndpointOverrideInterceptorTest {

    /** Runs [url] through the interceptor and returns the URL that would hit the network. */
    private fun resolve(overrides: Map<String, String>, url: String): String {
        var seen = ""
        val terminal = Interceptor { chain ->
            seen = chain.request().url.toString()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(200).message("OK").body("".toResponseBody()).build()
        }
        OkHttpClient.Builder()
            .addInterceptor(EndpointOverrideInterceptor(overrides))
            .addInterceptor(terminal)
            .build()
            .newCall(Request.Builder().url(url).build())
            .execute().close()
        return seen
    }

    @Test fun `mapped path is rewritten and query kept`() = assertEquals(
        "https://host.example/api/language/get_labels/?language=1",
        resolve(
            mapOf("api/language/v2/get_labels/" to "api/language/get_labels/"),
            "https://host.example/api/language/v2/get_labels/?language=1"
        )
    )

    @Test fun `base url path prefix survives`() = assertEquals(
        "https://host.example/mobile-app-dev/api/b/",
        resolve(mapOf("api/a/" to "api/b/"), "https://host.example/mobile-app-dev/api/a/")
    )

    @Test fun `unmapped path untouched`() = assertEquals(
        "https://host.example/api/chat/new_conversation/",
        resolve(mapOf("api/a/" to "api/b/"), "https://host.example/api/chat/new_conversation/")
    )

    @Test fun `no overrides is a no-op`() = assertEquals(
        "https://host.example/api/a/",
        resolve(emptyMap(), "https://host.example/api/a/")
    )
}
