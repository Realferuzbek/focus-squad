const { promises: fs } = require('fs');
const path = require('path');

const BACKGROUNDS_DIR = path.join(process.cwd(), 'assets', 'backgrounds');
const IMG_REGEX = /\.(png|jpe?g)$/i;

module.exports = async function backgrounds(req, res) {
  try {
    const entries = await fs.readdir(BACKGROUNDS_DIR, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && IMG_REGEX.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const images = files.map((name) => `assets/backgrounds/${name}`);

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(200).json({ images });
  } catch (error) {
    console.error('[api/backgrounds] failed to enumerate backgrounds:', error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ error: 'Failed to enumerate background images.' });
  }
};
