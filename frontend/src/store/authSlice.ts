import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "./axios";
import { isAxiosError } from "axios";

const fetchUser = createAsyncThunk("auth/fetchUser", async (token: string) => {
  try {
    if (!token || token.trim() === "") {
      throw new Error("No token found");
    }

    const { data } = await axios.get("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      isAuthenticated: true,
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        department: data.department,
        role: data.role,
      },
      token: token,
      role: data.role,
    };
  } catch (error: unknown) {
    if (isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || "Failed to fetch user");
    }
    throw new Error("Failed to fetch user");
  }
});

export interface AuthUser {
  id: string;
  name?: string;
  email: string;
  department?: string | null;
  role: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  role: string | null;
  user: AuthUser | null;
  loading?: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  role: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthState: (state, action: PayloadAction<AuthState>) => {
      state.isAuthenticated = action.payload.isAuthenticated;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.role = action.payload.role;
    },
    clearAuthState: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.role = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchUser.fulfilled, (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.role = action.payload.role;
    });
  },
});

export const { setAuthState, clearAuthState } = authSlice.actions;
export { fetchUser };
export default authSlice.reducer;