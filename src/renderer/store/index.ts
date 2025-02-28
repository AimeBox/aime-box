import { configureStore } from '@reduxjs/toolkit';
import { providerSlice } from './providerSlice';
import { settingsSlice } from './settingsSlice';
import { Providers } from '@/entity/Providers';
import { GlobalSettings } from '@/main/settings';

export interface State {
  provider: { providers: Providers[] };
  settings: { settings: GlobalSettings };
}

export default configureStore<State>({
  reducer: {
    provider: providerSlice.reducer,
    settings: settingsSlice.reducer,
  },
});
