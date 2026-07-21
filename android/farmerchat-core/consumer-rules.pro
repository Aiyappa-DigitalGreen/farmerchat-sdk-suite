# FarmerChat SDK — consumer ProGuard rules
# Keep all domain models (Gson reflection)
-keep class org.digitalgreen.farmerchat.sdk.core.model.** { *; }
-keep class org.digitalgreen.farmerchat.sdk.core.base.ApiResult { *; }
-keep class org.digitalgreen.farmerchat.sdk.core.base.ApiResult$* { *; }

# Retrofit annotations
-keepattributes Signature, InnerClasses, EnclosingMethod, RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations, AnnotationDefault
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
