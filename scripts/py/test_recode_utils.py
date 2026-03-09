from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from utils_recode import collapse_census_data, normalize_public_output_columns


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


if __name__ == '__main__':
    unittest.main()
