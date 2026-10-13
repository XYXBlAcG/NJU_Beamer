import { customMathFontNameSchema, type TextFont } from "../domain/deck";
import { textFontOptions } from "../domain/fonts";
import { SelectField } from "./SelectField";

export function TextFontField({ value, onChange }: { value?: TextFont; onChange: (value?: TextFont) => void }) {
  return <div className="text-font-field">
    <label>字体<SelectField value={value?.preset ?? "inherit"} options={textFontOptions} onChange={(preset) => onChange(preset === "inherit" ? undefined : { preset, customName: value?.customName ?? "", cjkName: value?.cjkName ?? "" })} /></label>
    {value?.preset === "custom" && <div className="inline-fields">
      <label>西文字体<input value={value.customName} placeholder="TeX Gyre Termes" onChange={(event) => { if (customMathFontNameSchema.safeParse(event.target.value).success) onChange({ ...value, customName: event.target.value }); }} /></label>
      <label>中文字体<input value={value.cjkName} placeholder="Songti SC" onChange={(event) => { if (customMathFontNameSchema.safeParse(event.target.value).success) onChange({ ...value, cjkName: event.target.value }); }} /></label>
    </div>}
  </div>;
}
