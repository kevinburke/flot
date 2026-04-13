import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const harnessPath = join(root, "tests/browser/harness.html");
const allowedRoots = new Map([
	["/dist/", join(root, "dist")],
	["/source/", join(root, "source")],
	["/lib/", join(root, "lib")],
	["/tests/", join(root, "tests")],
	["/examples/", join(root, "examples")],
]);

const mimeTypes = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
};

http
	.createServer(async (req, res) => {
		try {
			const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
			const path = url.pathname === "/" ? harnessPath : resolvePath(url.pathname);
			if (!path) {
				res.writeHead(404);
				res.end("not found");
				return;
			}

			const info = await stat(path);
			if (!info.isFile()) {
				res.writeHead(404);
				res.end("not found");
				return;
			}

			res.writeHead(200, {
				"content-type": mimeTypes[extname(path)] ?? "application/octet-stream",
			});
			createReadStream(path).pipe(res);
		} catch (error) {
			res.writeHead(500, {
				"content-type": "text/plain; charset=utf-8",
			});
			res.end(error instanceof Error ? error.message : String(error));
		}
	})
	.listen(port, () => {
		console.log(`test harness listening on http://localhost:${port}`);
	});

function resolvePath(requestPath) {
	for (const [prefix, baseDir] of allowedRoots) {
		if (!requestPath.startsWith(prefix)) {
			continue;
		}

		const relativePath = normalize(requestPath.slice(prefix.length)).replace(/^(\.\.[/\\])+/, "");
		const path = resolve(baseDir, relativePath);
		if (!path.startsWith(baseDir)) {
			return null;
		}
		return path;
	}

	return null;
}
