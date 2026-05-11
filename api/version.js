export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const version =
        process.env.APP_VERSION ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.VERCEL_GIT_COMMIT_REF ||
        "local-development";

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    return res.status(200).json({
        success: true,
        version
    });
}
