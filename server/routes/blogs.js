import { Router } from "express";
import { q } from "../db.js";
const r = Router();

// Public: list published blogs
r.get("/", async (req, res, next) => {
  try {
    if (req.query.all) return res.json(await q("SELECT * FROM blogs ORDER BY created_at DESC"));
    res.json(await q(
      "SELECT id, slug, title, title_hi, excerpt, excerpt_hi, image_url, category, author, views_count, created_at FROM blogs WHERE is_published=1 ORDER BY created_at DESC LIMIT 200"
    ));
  } catch (e) { next(e); }
});

r.get("/:slug", async (req, res, next) => {
  try {
    const rows = await q("SELECT * FROM blogs WHERE slug=? LIMIT 1", [req.params.slug]);
    if (rows[0]) q("UPDATE blogs SET views_count=views_count+1 WHERE id=?", [rows[0].id]).catch(()=>{});
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

export default r;
