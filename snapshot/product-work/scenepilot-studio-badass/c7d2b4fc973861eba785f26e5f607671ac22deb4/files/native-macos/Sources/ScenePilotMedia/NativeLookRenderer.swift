import CoreImage
import ScenePilotCore

/// The sequence look, ported line for line from Pro's grade fragment shader
/// (GRADE_FRAGMENT_SHADER in lib/grade.ts): mirror fold, chromatic aberration,
/// anamorphic streak, bloom, exposure with beat kick, contrast, temperature, tint,
/// saturation, vignette and film grain, in that order, on display-encoded values.
/// Coordinates are Pro's texture space (origin top-left, 0...1).
enum NativeLookRenderer {
    private static let source = """
    vec2 px(vec2 p, vec2 size) { return vec2(p.x * size.x, (1.0 - p.y) * size.y); }
    float grainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    kernel vec4 scenepilotLook(sampler scene, vec2 size, vec4 tone, vec4 texture, vec4 clock, vec4 fold) {
        vec2 dc = destCoord();
        vec2 uv = vec2(dc.x / size.x, 1.0 - dc.y / size.y);
        vec2 suv = uv;
        if (fold.x > 0.5) {
            if (fold.x < 1.5 || fold.x > 2.5) suv.x = 0.5 - abs(suv.x - 0.5);
            if (fold.x > 1.5) suv.y = 0.5 - abs(suv.y - 0.5);
        }
        float beat = clock.y;
        float aberration = texture.z * (1.0 + beat * 2.0);
        vec2 dir = suv - 0.5;
        vec3 color = vec3(sample(scene, samplerTransform(scene, px(suv - dir * aberration, size))).r,
                          sample(scene, samplerTransform(scene, px(suv, size))).g,
                          sample(scene, samplerTransform(scene, px(suv + dir * aberration, size))).b);
        if (fold.y > 0.0) {
            vec3 streak = vec3(0.0);
            float texel = 1.0 / size.x;
            for (int i = 1; i <= 8; i++) {
                float off = float(i) * texel * 9.0;
                streak += max(sample(scene, samplerTransform(scene, px(suv + vec2(off, 0.0), size))).rgb - 0.62, 0.0);
                streak += max(sample(scene, samplerTransform(scene, px(suv - vec2(off, 0.0), size))).rgb - 0.62, 0.0);
            }
            color += streak / 16.0 * fold.y * 2.4;
        }
        if (texture.y > 0.0) {
            vec3 bloom = vec3(0.0);
            float texel = 1.5 / size.y;
            for (int i = -2; i <= 2; i++) {
                for (int j = -2; j <= 2; j++) {
                    vec3 s = sample(scene, samplerTransform(scene, px(suv + vec2(float(i), float(j)) * texel * 2.0, size))).rgb;
                    bloom += max(s - 0.6, 0.0);
                }
            }
            color += bloom / 25.0 * texture.y * (1.0 + beat);
        }
        color *= tone.x * (1.0 + beat * 0.25);
        color = (color - 0.5) * tone.y + 0.5;
        color.r += tone.w * 0.08;
        color.b -= tone.w * 0.08;
        color.r += texture.x * 0.04;
        color.g -= texture.x * 0.08;
        color.b += texture.x * 0.04;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, tone.z);
        vec2 d = uv - 0.5;
        float edge = clamp((dot(d, d) * 2.2 - 0.8) / (0.2 - 0.8), 0.0, 1.0);
        color *= mix(1.0, edge * edge * (3.0 - 2.0 * edge), texture.w);
        if (clock.x > 0.0) {
            color += (grainHash(uv * size + clock.z) - 0.5) * clock.x;
        }
        return vec4(clamp(color, 0.0, 1.0), 1.0);
    }
    """
    // Core Image kernel language is deprecated in favour of precompiled Metal kernels,
    // which SwiftPM cannot build; this source compiles to Metal at runtime.
    private static let kernel: CIKernel = {
        guard let kernel = CIKernel(source: source) else { fatalError("Sequence look kernel failed to compile.") }
        return kernel
    }()

    /// `encoded` is true when the working space already holds sRGB-encoded values.
    static func apply(_ image: CIImage, look: NativeLook, time: Double, bounds: CGRect, encoded: Bool) -> CIImage {
        var l = look.look
        if let energy = look.rhythm?.energy(at: time) { l = l.at(energy: energy) }
        let beat = l.pulse.map { look.rhythm?.envelope(at: time, $0) ?? 0 } ?? 0
        let input = (encoded ? image : image.applyingFilter("CILinearToSRGBToneCurve")).clampedToExtent()
        let arguments: [Any] = [input, CIVector(x: bounds.width, y: bounds.height),
                                CIVector(x: l.exposure, y: l.contrast, z: l.saturation, w: l.temperature),
                                CIVector(x: l.tint, y: l.bloom, z: l.aberration, w: l.vignette),
                                CIVector(x: l.grain, y: beat, z: time * 60, w: 0),
                                CIVector(x: Double(l.mirror), y: l.streak, z: 0, w: 0)]
        // A mirror fold can read anywhere in the frame; streak and bloom read nearby.
        guard let graded = kernel.apply(extent: bounds, roiCallback: { _, _ in bounds.insetBy(dx: -96, dy: -96) }, arguments: arguments) else { return image }
        return encoded ? graded : graded.applyingFilter("CISRGBToneCurveToLinear")
    }
}
