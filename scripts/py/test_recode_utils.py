from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from utils_recode import (
    collapse_census_data,
    moe_scale_factor,
    normalize_public_output_columns,
    scale_moe_columns,
)


class RecodeUtilsTests(unittest.TestCase):
    def test_collapse_handles_passthrough_sum_and_rss(self) -> None:
        input_df = pd.DataFrame(
            {
                'GEOID': ['06073000100', '06073000200'],
                'foo_a_e': [10, 20],
                'foo_b_e': [2, 3],
                'foo_a_m': [1, 2],
                'foo_b_m': [4, 5],
                'direct_e': [100, 200],
            }
        )

        recodes = {
            'foo_total_e': ['foo_a_e', 'foo_b_e'],
            'foo_total_m': ['foo_a_m', 'foo_b_m'],
            'direct_passthrough_e': 'direct_e',
        }

        collapsed = collapse_census_data(input_df, recodes)
        public = normalize_public_output_columns(collapsed)

        self.assertEqual(public['foo_total'].tolist(), [12, 23])
        self.assertAlmostEqual(public['foo_total_moe'].iloc[0], np.sqrt(17.0), places=6)
        self.assertAlmostEqual(public['foo_total_moe'].iloc[1], np.sqrt(29.0), places=6)
        self.assertEqual(public['direct_passthrough'].tolist(), [100, 200])

    def test_collapse_raises_on_missing_columns(self) -> None:
        input_df = pd.DataFrame(
            {
                'GEOID': ['06073000100'],
                'foo_e': [1],
            }
        )
        recodes = {
            'foo_sum_e': ['foo_e', 'bar_e'],
        }

        with self.assertRaises(KeyError):
            collapse_census_data(input_df, recodes)

    def test_scale_moe_columns_to_95_percent(self) -> None:
        input_df = pd.DataFrame(
            {
                'GEOID': ['06073000100'],
                'foo_m': [10.0],
                'bar_e': [5.0],
            }
        )
        scaled = scale_moe_columns(
            input_df,
            source_confidence_level=90,
            target_confidence_level=95,
        )

        expected_factor = 1.96 / 1.645
        self.assertAlmostEqual(scaled['foo_m'].iloc[0], 10.0 * expected_factor, places=6)
        self.assertEqual(scaled['bar_e'].iloc[0], 5.0)

    def test_moe_scale_factor_noop_when_level_matches(self) -> None:
        self.assertEqual(moe_scale_factor(95, 95), 1.0)


if __name__ == '__main__':
    unittest.main()
