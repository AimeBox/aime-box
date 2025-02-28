import i18n from '@/i18n';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const initialState = {
  settings: null,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings: (state, action) => {
      state.settings = action.payload;
      i18n.changeLanguage(state.settings.language || 'zh-CN');
    },
  },
});

// 导出 action creators
export const { setSettings } = settingsSlice.actions;

// 导出 reducer
export default settingsSlice.reducer;
