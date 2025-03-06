import { Providers } from '@/entity/Providers';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchProviders = createAsyncThunk(
  'provider/fetchProviders',
  async () => {
    try {
      const providers = await window.electron.providers.getList();
      return providers;
    } catch (err) {
      console.error(err);
      return [] as Providers[];
    }
  },
);

const initialState = {
  providers: [] as Providers[],
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null as string | null,
};

export const providerSlice = createSlice({
  name: 'provider',
  initialState,
  reducers: {
    // 移除了同步的getProviders
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProviders.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchProviders.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.providers = action.payload;
      })
      .addCase(fetchProviders.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || '获取提供者列表失败';
      });
  },
});

// 不再导出同步action
// export const { } = providerSlice.actions;

// 导出 reducer
export default providerSlice.reducer;
