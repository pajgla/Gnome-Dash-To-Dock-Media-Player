import GdkPixbuf from 'gi://GdkPixbuf';

export const CoverArtHelpers = {
    getAverageRGB(pixBuf)
    {
        const scaled = pixBuf.scale_simple(1, 1, GdkPixbuf.InterpType.BILINEAR);
        const pixels = scaled.get_pixels();
        return pixels; //returns array [r,g,b]
    },

    //https://en.wikipedia.org/wiki/Relative_luminance
    isDark(rgbArr)
    {
        const luma = (0.2126 * rgbArr[0] + 0.7152 * rgbArr[1] + 0.0722 * rgbArr[2]) / 255;
        return luma < 0.5;
    }
}