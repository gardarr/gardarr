package schemas

// TimezoneUpdateRequest represents the request body for updating timezone
type TimezoneUpdateRequest struct {
	Timezone string `json:"timezone" binding:"required"`
}

// ThemeUpdateRequest represents the request body for updating theme
type ThemeUpdateRequest struct {
	Theme string `json:"theme" binding:"required"`
}

// LanguageUpdateRequest represents the request body for updating language
type LanguageUpdateRequest struct {
	Language string `json:"language" binding:"required"`
}
