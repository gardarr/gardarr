package releaseparse

import "testing"

func TestParse(t *testing.T) {
	tests := []struct {
		name, raw, title, year, season, episode, resolution, source, codec, audio, language, edition, group string
		typeValue                                                                                           ReleaseType
		confidence                                                                                          Confidence
	}{
		{"movie", "The.Matrix.1999.2160p.UHD.BluRay.x265.DTS-HD.MA.5.1-GROUP", "The Matrix", "1999", "", "", "2160p", "uhd", "x265", "dts-hd", "", "", "GROUP", ReleaseTypeMovie, ConfidenceHigh},
		{"series episode", "The.Last.of.Us.S01E04.1080p.WEB-DL.x264.DUAL-GRP", "The Last of Us", "", "01", "04", "1080p", "web-dl", "x264", "", "dual", "", "GRP", ReleaseTypeSeries, ConfidenceHigh},
		{"x episode", "Show.Name.1x04.720p.HDTV.AAC", "Show Name", "", "1", "04", "720p", "hdtv", "", "aac", "", "", "", ReleaseTypeSeries, ConfidenceHigh},
		{"edition", "Movie.2024.Directors.Cut.WEBRip.HEVC.Atmos", "Movie", "2024", "", "", "", "webrip", "hevc", "atmos", "", "directors cut", "", ReleaseTypeMovie, ConfidenceHigh},
		{"plain", "A Simple Title", "A Simple Title", "", "", "", "", "", "", "", "", "", "", ReleaseTypeMovie, ConfidenceMedium},
		{"empty", "", "", "", "", "", "", "", "", "", "", "", "", ReleaseTypeMovie, ConfidenceLow},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Parse(tt.raw)
			if got.Title != tt.title || got.Year != tt.year || got.Season != tt.season || got.Episode != tt.episode || got.Resolution != tt.resolution || got.Source != tt.source || got.Codec != tt.codec || got.Audio != tt.audio || got.Language != tt.language || got.Edition != tt.edition || got.Group != tt.group || got.Type != tt.typeValue || got.Confidence != tt.confidence {
				t.Fatalf("Parse(%q) = %#v", tt.raw, got)
			}
		})
	}
}

func TestResultDerivedValues(t *testing.T) {
	got := Parse("The.Matrix.1999.2160p.BluRay.x265")
	if got.SearchQuery() != "The Matrix 1999" || got.DisplayName() != "The Matrix (1999)" {
		t.Fatalf("unexpected derived values: %#v", got)
	}
	want := []string{"quality::2160p", "source::bluray", "codec::x265"}
	tags := got.SuggestedTags()
	if len(tags) != len(want) {
		t.Fatalf("tags = %v", tags)
	}
	for i := range want {
		if tags[i] != want[i] {
			t.Fatalf("tags = %v, want %v", tags, want)
		}
	}
}

func TestParseDecodesHTMLEntitiesInSuggestedDisplayName(t *testing.T) {
	got := Parse("Assassin&#039;s Creed: Black Flag Resynced - Deluxe Edition")
	if got.Raw != "Assassin&#039;s Creed: Black Flag Resynced - Deluxe Edition" {
		t.Fatalf("Raw = %q", got.Raw)
	}
	if got.Title != "Assassin's Creed: Black Flag Resynced" || got.DisplayName() != "Assassin's Creed: Black Flag Resynced" {
		t.Fatalf("unexpected parsed display name: %#v", got)
	}
	if got.Edition != "deluxe" || got.Confidence != ConfidenceHigh {
		t.Fatalf("unexpected parsed metadata: %#v", got)
	}
}

func TestParseDomainReleases(t *testing.T) {
	tests := []struct {
		name, raw, title, version, format, distro, platform, architecture, volume string
		typeValue                                                                 ReleaseType
		wantTags                                                                  []string
	}{
		{
			name:         "operating system",
			raw:          "Ubuntu.24.04.2.Desktop.amd64.iso",
			title:        "Ubuntu",
			version:      "24.04.2",
			format:       "iso",
			distro:       "ubuntu",
			architecture: "x86_64",
			typeValue:    ReleaseTypeOS,
			wantTags:     []string{"type::os", "distro::ubuntu", "format::iso", "architecture::x86_64", "version::24.04.2"},
		},
		{
			name:      "game",
			raw:       "Elden.Ring.Shadow.of.the.Erdtree.v1.12.0.PC-RUNE",
			title:     "Elden Ring Shadow of the Erdtree",
			version:   "1.12.0",
			platform:  "pc",
			typeValue: ReleaseTypeGame,
			wantTags:  []string{"type::game", "platform::pc", "version::1.12.0", "group::rune"},
		},
		{
			name:      "book",
			raw:       "Dune.Messiah.Book.2.EPUB",
			title:     "Dune Messiah",
			format:    "epub",
			volume:    "2",
			typeValue: ReleaseTypeBook,
			wantTags:  []string{"type::book", "format::epub", "volume::2"},
		},
		{
			name:      "music",
			raw:       "Daft.Punk.Random.Access.Memories.2013.FLAC",
			title:     "Daft Punk Random Access Memories",
			format:    "flac",
			typeValue: ReleaseTypeMusic,
			wantTags:  []string{"type::music", "format::flac"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Parse(tt.raw)
			if got.Title != tt.title || got.Version != tt.version || got.Format != tt.format || got.Distro != tt.distro || got.Platform != tt.platform || got.Architecture != tt.architecture || got.Volume != tt.volume || got.Type != tt.typeValue || got.Confidence != ConfidenceHigh {
				t.Fatalf("Parse(%q) = %#v", tt.raw, got)
			}
			if len(got.SuggestedTags()) != len(tt.wantTags) {
				t.Fatalf("SuggestedTags() = %v, want %v", got.SuggestedTags(), tt.wantTags)
			}
			for index, want := range tt.wantTags {
				if got.SuggestedTags()[index] != want {
					t.Fatalf("SuggestedTags() = %v, want %v", got.SuggestedTags(), tt.wantTags)
				}
			}
		})
	}
}

func TestParseExtendedDomainReleases(t *testing.T) {
	tests := []struct {
		name, raw, title, format, version, platform string
		typeValue                                   ReleaseType
		wantTags                                    []string
	}{
		{
			name:      "software",
			raw:       "Visual.Studio.Code.1.92.0.macOS.dmg",
			title:     "Visual Studio Code",
			format:    "dmg",
			version:   "1.92.0",
			platform:  "macos",
			typeValue: ReleaseTypeSoftware,
			wantTags:  []string{"type::software", "distro::macos", "platform::macos", "format::dmg", "version::1.92.0"},
		},
		{
			name:      "audiobook",
			raw:       "Project.Hail.Mary.Audiobook.m4b",
			title:     "Project Hail Mary",
			format:    "m4b",
			typeValue: ReleaseTypeAudiobook,
			wantTags:  []string{"type::audiobook", "format::m4b"},
		},
		{
			name:      "comic",
			raw:       "One.Piece.Volume.1.CBZ",
			title:     "One Piece",
			format:    "cbz",
			typeValue: ReleaseTypeComic,
			wantTags:  []string{"type::comic", "format::cbz", "volume::1"},
		},
		{
			name:      "course",
			raw:       "Modern.React.Udemy.2025.1080p",
			title:     "Modern React",
			typeValue: ReleaseTypeCourse,
			wantTags:  []string{"quality::1080p", "type::course", "provider::udemy"},
		},
		{
			name:      "dataset",
			raw:       "ImageNet.Dataset.2024.parquet",
			title:     "ImageNet",
			format:    "parquet",
			typeValue: ReleaseTypeDataset,
			wantTags:  []string{"type::dataset", "format::parquet"},
		},
		{
			name:      "rom",
			raw:       "Super.Mario.World.SNES.ROM",
			title:     "Super Mario World",
			platform:  "snes",
			typeValue: ReleaseTypeROM,
			wantTags:  []string{"type::rom", "platform::snes"},
		},
		{
			name:      "podcast",
			raw:       "Tech.Today.Podcast.Episode.42.MP3",
			title:     "Tech Today",
			format:    "mp3",
			typeValue: ReleaseTypePodcast,
			wantTags:  []string{"episode::42", "type::podcast", "format::mp3"},
		},
		{
			name:      "anime",
			raw:       "Frieren.Anime.S01E01.1080p.WEB-DL.HEVC",
			title:     "Frieren",
			typeValue: ReleaseTypeAnime,
			wantTags:  []string{"quality::1080p", "source::web-dl", "codec::hevc", "season::01", "episode::01", "type::anime"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Parse(tt.raw)
			if got.Title != tt.title || got.Format != tt.format || got.Version != tt.version || got.Platform != tt.platform || got.Type != tt.typeValue || got.Confidence != ConfidenceHigh {
				t.Fatalf("Parse(%q) = %#v", tt.raw, got)
			}
			if len(got.SuggestedTags()) != len(tt.wantTags) {
				t.Fatalf("SuggestedTags() = %v, want %v", got.SuggestedTags(), tt.wantTags)
			}
			for index, want := range tt.wantTags {
				if got.SuggestedTags()[index] != want {
					t.Fatalf("SuggestedTags() = %v, want %v", got.SuggestedTags(), tt.wantTags)
				}
			}
		})
	}
}

func TestParseExpandedUseCases(t *testing.T) {
	tests := []struct {
		name, raw, title string
		typeValue        ReleaseType
		wantTags         []string
	}{
		{"movie HDR", "Dune.Part.Two.2024.2160p.IMAX.HDR10+.Dolby.Vision", "Dune Part Two", ReleaseTypeMovie, []string{"hdr::hdr10+"}},
		{"complete series", "The.Bear.S03.Complete.1080p.WEB-DL", "The Bear", ReleaseTypeSeries, []string{"season::03", "package::complete"}},
		{"operating system image", "Fedora.Workstation.40.x86_64.ISO", "Fedora", ReleaseTypeOS, []string{"type::os", "architecture::x86_64", "format::iso"}},
		{"game DLC", "Cyberpunk.2077.Phantom.Liberty.DLC.v2.1.PC.Steam", "Cyberpunk 2077 Phantom Liberty", ReleaseTypeGame, []string{"type::game", "provider::steam", "package::dlc", "version::2.1"}},
		{"book edition", "Dune.Messiah.50th.Anniversary.EPUB", "Dune Messiah 50th", ReleaseTypeBook, []string{"type::book", "edition::anniversary"}},
		{"music edition", "Random.Access.Memories.Deluxe.FLAC", "Random Access Memories", ReleaseTypeMusic, []string{"type::music", "edition::deluxe"}},
		{"software package", "Docker.Desktop.4.33.1.macOS.ARM64.DMG", "Docker Desktop", ReleaseTypeSoftware, []string{"type::software", "architecture::arm64", "format::dmg", "version::4.33.1"}},
		{"audiobook provider", "Dune.Audible.Audiobook.m4b", "Dune", ReleaseTypeAudiobook, []string{"type::audiobook", "provider::audible"}},
		{"comic issue", "Batman.Issue.50.Comic.CBR", "Batman", ReleaseTypeComic, []string{"type::comic", "issue::50"}},
		{"course provider", "Data.Science.Udemy.2025", "Data Science", ReleaseTypeCourse, []string{"type::course", "provider::udemy"}},
		{"dataset source", "Open.Assistant.Model.Hugging.Face.safetensors", "Open Assistant Model", ReleaseTypeDataset, []string{"type::dataset", "provider::hugging face", "format::safetensors"}},
		{"ROM region", "Super.Mario.World.SNES.USA.ROM", "Super Mario World", ReleaseTypeROM, []string{"type::rom", "platform::snes", "region::usa"}},
		{"podcast episode", "Tech.Today.Podcast.S02E10.MP3", "Tech Today", ReleaseTypePodcast, []string{"type::podcast", "season::02", "episode::10"}},
		{"anime release", "Frieren.Anime.S01E01.1080p.WEB-DL.HEVC.DUAL", "Frieren", ReleaseTypeAnime, []string{"type::anime", "season::01", "episode::01", "language::dual"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Parse(tt.raw)
			if got.Title != tt.title || got.Type != tt.typeValue || got.Confidence != ConfidenceHigh {
				t.Fatalf("Parse(%q) = %#v", tt.raw, got)
			}
			for _, wantTag := range tt.wantTags {
				if !hasTag(got.SuggestedTags(), wantTag) {
					t.Fatalf("SuggestedTags() = %v, missing %q", got.SuggestedTags(), wantTag)
				}
			}
		})
	}
}

func hasTag(tags []string, want string) bool {
	for _, tag := range tags {
		if tag == want {
			return true
		}
	}
	return false
}

func TestParseBareYearIsMediumConfidence(t *testing.T) {
	got := Parse("Some Old Home Video 2004")
	if got.Confidence != ConfidenceMedium {
		t.Fatalf("Parse() confidence = %v, want medium", got.Confidence)
	}
}

func TestParseTwoWeakMarkersUpgradeToHighConfidence(t *testing.T) {
	got := Parse("Voyage.2004.MULTI")
	if got.Confidence != ConfidenceHigh {
		t.Fatalf("Parse() confidence = %v, want high", got.Confidence)
	}
}

func TestParseMovieTitleWithBareEpisodeWordStaysMovie(t *testing.T) {
	got := Parse("Star Wars Episode 4 A New Hope 1080p BluRay x264")
	if got.Type != ReleaseTypeMovie {
		t.Fatalf("Type = %v, want movie (bare 'Episode N' in a movie title should not force series)", got.Type)
	}
	if got.Episode != "" {
		t.Fatalf("Episode = %q, want empty when a video signal is present", got.Episode)
	}
}

func TestParseMovieTitleWithBareVolumeWordStaysMovie(t *testing.T) {
	got := Parse("Kill.Bill.Volume.1.2003.1080p.BluRay.x264")
	if got.Type != ReleaseTypeMovie {
		t.Fatalf("Type = %v, want movie (bare 'Volume N' in a movie title should not force book)", got.Type)
	}
	if got.Volume != "" {
		t.Fatalf("Volume = %q, want empty when a video signal is present", got.Volume)
	}
}

func TestParseVideoFileExtensionSuppressesBareVolumeWord(t *testing.T) {
	// No resolution/source/codec marker here, but a video container
	// extension alone must be enough to treat "Volume 2" as part of the
	// title (e.g. a home-video series), not a book/comic volume number.
	got := Parse("Vacation.Volume.2.2020.mkv")
	if got.Type != ReleaseTypeMovie {
		t.Fatalf("Type = %v, want movie (a .mkv file is a video signal even without resolution/source/codec)", got.Type)
	}
	if got.Volume != "" {
		t.Fatalf("Volume = %q, want empty when the filename has a video extension", got.Volume)
	}
}

func TestParseGroupRejectsMetadataLookingTokens(t *testing.T) {
	got := Parse("Movie.2020-1080p")
	if got.Group != "" {
		t.Fatalf("Group = %q, want empty (resolution token should not be treated as a group)", got.Group)
	}
}

func TestParseLanguageCodes(t *testing.T) {
	tests := []struct{ raw, language string }{
		{"Filme.2020.Dublado", "dublado"},
		{"Filme.2020.PT-BR", "pt-br"},
		{"Film.2020.VOSTFR", "vostfr"},
		{"Film.2020.FRENCH", "french"},
	}
	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			got := Parse(tt.raw)
			if got.Language != tt.language {
				t.Fatalf("Parse(%q).Language = %q, want %q", tt.raw, got.Language, tt.language)
			}
		})
	}
}

func TestParseFansubBracketDetectsAnime(t *testing.T) {
	got := Parse("[SubsPlease] Frieren - 12 [1080p].mkv")
	if got.Type != ReleaseTypeAnime {
		t.Fatalf("Type = %v, want anime", got.Type)
	}
	if got.Title != "Frieren" {
		t.Fatalf("Title = %q, want %q", got.Title, "Frieren")
	}
	if got.Episode != "12" {
		t.Fatalf("Episode = %q, want %q", got.Episode, "12")
	}
	if got.Group != "SubsPlease" {
		t.Fatalf("Group = %q, want %q", got.Group, "SubsPlease")
	}
}

func TestResultRefineWithFileExtensions(t *testing.T) {
	got := Parse("My Comic Collection")
	if got.Format != "" {
		t.Fatalf("precondition failed: Format = %q, want empty", got.Format)
	}

	refined := got.RefineWithFileExtensions([]string{"nfo", "cbz", "cbz", "jpg"})
	if refined.Format != "cbz" || refined.Type != ReleaseTypeComic || refined.Confidence != ConfidenceHigh {
		t.Fatalf("RefineWithFileExtensions() = %#v", refined)
	}
}

func TestResultRefineWithFileExtensionsKeepsAudiobookType(t *testing.T) {
	got := Parse("Dune.Audiobook")
	if got.Type != ReleaseTypeAudiobook {
		t.Fatalf("precondition failed: Type = %v, want audiobook", got.Type)
	}

	refined := got.RefineWithFileExtensions([]string{"mp3"})
	if refined.Type != ReleaseTypeAudiobook {
		t.Fatalf("RefineWithFileExtensions() Type = %v, want audiobook (mp3 is also a music format, but the marker word must still win)", refined.Type)
	}
}

func TestResultRefineWithFileExtensionsNoopWhenFormatAlreadyKnown(t *testing.T) {
	got := Parse("Movie.2020.EPUB")
	refined := got.RefineWithFileExtensions([]string{"cbz"})
	if refined.Format != got.Format {
		t.Fatalf("RefineWithFileExtensions() should not override an existing format: got %q", refined.Format)
	}
}
