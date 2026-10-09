import { BlendModeFilter, ExtensionType, hslgl, hslgpu } from "pixi.js";

export class HueBlend extends BlendModeFilter {
  static extension = { name: "hue", type: ExtensionType.BlendMode };

  constructor() {
    super({
      gl: {
        functions: `
          ${hslgl}

          vec3 blendHue(vec3 base, vec3 blend, float opacity)
          {
            vec3 blendHue = setLuminosity(setSaturation(blend, getSaturation(base)), getLuminosity(base));
            return (blendHue * opacity + base * (1.0 - opacity));
          }
        `,
        main: `
          finalColor = vec4(blendHue(back.rgb, front.rgb, front.a), blendedAlpha) * uBlend;
        `,
      },
      gpu: {
        functions: `
          ${hslgpu}

          fn blendHue(base:vec3<f32>, blend:vec3<f32>, opacity:f32) -> vec3<f32>
          {
            let blendHue = setLuminosity(setSaturation(blend, getSaturation(base)), getLuminosity(base));
            return (blendHue * opacity + base * (1.0 - opacity));
          }
        `,
        main: `
          out = vec4<f32>(blendHue(back.rgb, front.rgb, front.a), blendedAlpha) * blendUniforms.uBlend;
        `,
      },
    });
  }
}
