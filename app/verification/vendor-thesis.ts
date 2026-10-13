import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const { njuThesis } = JSON.parse(readFileSync(resolve("verification/vendor/sources.json"), "utf8"));
const repository = join(mkdtempSync(join(tmpdir(), "njub-thesis-vendor-")), "upstream");
execFileSync("gh", ["repo", "clone", njuThesis.repository, repository], { stdio: "inherit" });
execFileSync("git", ["checkout", "--detach", njuThesis.revision], { cwd: repository, stdio: "inherit" });
const source = join(repository, "source");
execFileSync("/Library/TeX/texbin/xetex", ["njuthesis.dtx"], { cwd: source, stdio: "inherit" });
const output = resolve("../templates/nju/paper");
mkdirSync(output, { recursive: true });
for (const file of ["njuthesis.cls", "njuthesis-undergraduate.def", "njuthesis-graduate.def", "njuthesis-postdoctoral.def", "nju-emblem-black.pdf", "nju-emblem-purple.pdf", "nju-name-black.pdf", "nju-name-purple.pdf", "LICENSE"]) {
  cpSync(join(file === "LICENSE" ? repository : source, file), join(output, file));
}
