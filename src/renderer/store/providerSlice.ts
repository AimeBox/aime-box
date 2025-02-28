import { Providers } from '@/entity/Providers';
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  providers: [] as Providers[],
};

export const providerSlice = createSlice({
  name: 'provider',
  initialState,
  reducers: {
    getProviders: (state) => {
      window.electron.providers
        .getList()
        .then((providers) => {
          state.providers = providers;
          return providers;
        })
        .catch((err) => {
          console.error(err);
          return [];
        });
    },
  },
});

// 导出 action creators
export const { getProviders } = providerSlice.actions;

// 导出 reducer
export default providerSlice.reducer;
