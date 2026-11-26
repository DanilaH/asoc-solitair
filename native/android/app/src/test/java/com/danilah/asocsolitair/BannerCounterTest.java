package com.danilah.asocsolitair;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class BannerCounterTest {
    @Test public void acceptsSafeIntegerJsonNumbersFromCapacitor() {
        assertEquals(4L, SolitaireAdsPlugin.bannerCounter(Integer.valueOf(4)));
        assertEquals(4L, SolitaireAdsPlugin.bannerCounter(Long.valueOf(4)));
        assertEquals(4L, SolitaireAdsPlugin.bannerCounter(Double.valueOf(4)));
        assertEquals(9007199254740991L, SolitaireAdsPlugin.bannerCounter(9007199254740991L));
    }
    @Test public void rejectsMalformedOrUnsafeEpochs() {
        for (Object invalid : new Object[] { null, "4", -1, 0.25, Double.NaN, Double.POSITIVE_INFINITY, 9007199254740992L }) {
            assertEquals(-1L, SolitaireAdsPlugin.bannerCounter(invalid));
        }
    }
}
