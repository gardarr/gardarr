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
	TorrentDisplayMode          *string `json:"torrent_display_mode,omitempty" binding:"omitempty,oneof=default card"`
	Compact                     *bool   `json:"compact,omitempty"`
	BackgroundImageBlurIntensity *int    `json:"background_image_blur_intensity,omitempty" binding:"omitempty,min=0,max=100"`
}
