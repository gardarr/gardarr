package schemas

// UserRegisterRequest represents the request body for user registration
type UserRegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// UserLoginRequest represents the request body for user login
type UserLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// ChangePasswordRequest represents the request body for changing user password
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// UpdatePreferencesRequest represents the request body for updating user preferences
type UpdatePreferencesRequest struct {
	TorrentDisplayMode           *string `json:"torrent_display_mode,omitempty" binding:"omitempty,oneof=table card card_b list"`
	Compact                      *bool   `json:"compact,omitempty"`
	BackgroundImageBlurIntensity *int    `json:"background_image_blur_intensity,omitempty" binding:"omitempty,min=0,max=100"`
	ActiveColorPalette           *int    `json:"active_color_palette,omitempty" binding:"omitempty,min=1,max=3"`
	// Color Palette 1
	ColorPalette1Primary   *string `json:"color_palette_1_primary,omitempty" binding:"omitempty,hexcolor"`
	ColorPalette1Secondary *string `json:"color_palette_1_secondary,omitempty" binding:"omitempty,hexcolor"`
	ColorPalette1Accent    *string `json:"color_palette_1_accent,omitempty" binding:"omitempty,hexcolor"`
	ColorPalette1Muted     *string `json:"color_palette_1_muted,omitempty" binding:"omitempty,hexcolor"`
	// Color Palette 2
	ColorPalette2Primary   *string `json:"color_palette_2_primary,omitempty" binding:"omitempty,hexcolor"`
	ColorPalette2Secondary *string `json:"color_palette_2_secondary,omitempty" binding:"omitempty,hexcolor"`
	ColorPalette2Accent    *string `json:"color_palette_2_accent,omitempty" binding:"omitempty,hexcolor"`
	ColorPalette2Muted     *string `json:"color_palette_2_muted,omitempty" binding:"omitempty,hexcolor"`
	// Color Palette 3
	ColorPalette3Primary   *string `json:"color_palette_3_primary,omitempty" binding:"omitempty,hexcolor"`
	ColorPalette3Secondary *string `json:"color_palette_3_secondary,omitempty" binding:"omitempty,hexcolor"`
	ColorPalette3Accent    *string `json:"color_palette_3_accent,omitempty" binding:"omitempty,hexcolor"`
	ColorPalette3Muted     *string `json:"color_palette_3_muted,omitempty" binding:"omitempty,hexcolor"`
}
