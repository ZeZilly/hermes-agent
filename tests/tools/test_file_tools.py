"""Tests for the file tools module (schema, handler wiring, error paths).

Tests verify tool schemas, handler dispatch, validation logic, and error
handling without requiring a running terminal environment.
"""

import json
import logging
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from tools.file_tools import (
    FILE_TOOLS,
    READ_FILE_SCHEMA,
    WRITE_FILE_SCHEMA,
    PATCH_SCHEMA,
    SEARCH_FILES_SCHEMA,
)


class TestFileToolsList:
    def test_has_expected_entries(self):
        names = {t["name"] for t in FILE_TOOLS}
        assert names == {"read_file", "write_file", "patch", "search_files"}

    def test_each_entry_has_callable_function(self):
        for tool in FILE_TOOLS:
            assert callable(tool["function"]), f"{tool['name']} missing callable"

    def test_schemas_have_required_fields(self):
        """All schemas must have name, description, and parameters with properties."""
        for schema in [READ_FILE_SCHEMA, WRITE_FILE_SCHEMA, PATCH_SCHEMA, SEARCH_FILES_SCHEMA]:
            assert "name" in schema
            assert "description" in schema
            assert "properties" in schema["parameters"]


class TestReadFileHandler:
    @patch("tools.file_tools._get_file_ops")
    def test_returns_file_content(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.content = "line1\nline2"
        result_obj.to_dict.return_value = {"content": "line1\nline2", "total_lines": 2}
        mock_ops.read_file.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import read_file_tool
        result = json.loads(read_file_tool("/tmp/test.txt"))
        assert result["content"] == "line1\nline2"
        assert result["total_lines"] == 2
        mock_ops.read_file.assert_called_once_with("/tmp/test.txt", 1, 500)

    @patch("tools.file_tools._get_file_ops")
    def test_custom_offset_and_limit(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.content = "line10"
        result_obj.to_dict.return_value = {"content": "line10", "total_lines": 50}
        mock_ops.read_file.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import read_file_tool
        read_file_tool("/tmp/big.txt", offset=10, limit=20)
        mock_ops.read_file.assert_called_once_with("/tmp/big.txt", 10, 20)

    @patch("tools.file_tools._get_file_ops")
    def test_exception_returns_error_json(self, mock_get):
        mock_get.side_effect = RuntimeError("terminal not available")

        from tools.file_tools import read_file_tool
        result = json.loads(read_file_tool("/tmp/test.txt"))
        assert "error" in result
        assert "terminal not available" in result["error"]


class TestWriteFileHandler:
    @patch("tools.file_tools._get_file_ops")
    def test_writes_content(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {"status": "ok", "path": "/tmp/out.txt", "bytes": 13}
        mock_ops.write_file.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import write_file_tool
        result = json.loads(write_file_tool("/tmp/out.txt", "hello world!\n"))
        assert result["status"] == "ok"
        mock_ops.write_file.assert_called_once_with("/tmp/out.txt", "hello world!\n")

    @patch("tools.file_tools._get_file_ops")
    def test_permission_error_returns_error_json_without_error_log(self, mock_get, caplog):
        mock_get.side_effect = PermissionError("read-only filesystem")

        from tools.file_tools import write_file_tool
        with caplog.at_level(logging.DEBUG, logger="tools.file_tools"):
            result = json.loads(write_file_tool("/tmp/out.txt", "data"))
        assert "error" in result
        assert "read-only" in result["error"]
        assert any("write_file expected denial" in r.getMessage() for r in caplog.records)
        assert not any(r.levelno >= logging.ERROR for r in caplog.records)

    @patch("tools.file_tools._get_file_ops")
    def test_unexpected_exception_still_logs_error(self, mock_get, caplog):
        mock_get.side_effect = RuntimeError("boom")

        from tools.file_tools import write_file_tool
        with caplog.at_level(logging.ERROR, logger="tools.file_tools"):
            result = json.loads(write_file_tool("/tmp/out.txt", "data"))
        assert result["error"] == "boom"
        assert any("write_file error" in r.getMessage() for r in caplog.records)


class TestPatchHandler:
    @patch("tools.file_tools._get_file_ops")
    def test_replace_mode_calls_patch_replace(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {"status": "ok", "replacements": 1}
        mock_ops.patch_replace.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import patch_tool
        result = json.loads(patch_tool(
            mode="replace", path="/tmp/f.py",
            old_string="foo", new_string="bar"
        ))
        assert result["status"] == "ok"
        mock_ops.patch_replace.assert_called_once_with("/tmp/f.py", "foo", "bar", False)

    @patch("tools.file_tools._get_file_ops")
    def test_replace_mode_replace_all_flag(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {"status": "ok", "replacements": 5}
        mock_ops.patch_replace.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import patch_tool
        patch_tool(mode="replace", path="/tmp/f.py",
                   old_string="x", new_string="y", replace_all=True)
        mock_ops.patch_replace.assert_called_once_with("/tmp/f.py", "x", "y", True)

    @patch("tools.file_tools._get_file_ops")
    def test_replace_mode_missing_path_errors(self, mock_get):
        from tools.file_tools import patch_tool
        result = json.loads(patch_tool(mode="replace", path=None, old_string="a", new_string="b"))
        assert "error" in result

    @patch("tools.file_tools._get_file_ops")
    def test_replace_mode_missing_strings_errors(self, mock_get):
        from tools.file_tools import patch_tool
        result = json.loads(patch_tool(mode="replace", path="/tmp/f.py", old_string=None, new_string="b"))
        assert "error" in result

    @patch("tools.file_tools._get_file_ops")
    def test_patch_mode_calls_patch_v4a(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {"status": "ok", "operations": 1}
        mock_ops.patch_v4a.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import patch_tool
        result = json.loads(patch_tool(mode="patch", patch="*** Begin Patch\n..."))
        assert result["status"] == "ok"
        mock_ops.patch_v4a.assert_called_once()

    @patch("tools.file_tools._get_file_ops")
    def test_patch_mode_missing_content_errors(self, mock_get):
        from tools.file_tools import patch_tool
        result = json.loads(patch_tool(mode="patch", patch=None))
        assert "error" in result

    @patch("tools.file_tools._get_file_ops")
    def test_unknown_mode_errors(self, mock_get):
        from tools.file_tools import patch_tool
        result = json.loads(patch_tool(mode="invalid_mode"))
        assert "error" in result
        assert "Unknown mode" in result["error"]


class TestSearchHandler:
    @patch("tools.file_tools._get_file_ops")
    def test_search_calls_file_ops(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {"matches": ["file1.py:3:match"]}
        mock_ops.search.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import search_tool
        result = json.loads(search_tool(pattern="TODO", target="content", path="."))
        assert "matches" in result
        mock_ops.search.assert_called_once()

    @patch("tools.file_tools._get_file_ops")
    def test_search_passes_all_params(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {"matches": []}
        mock_ops.search.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import search_tool
        search_tool(pattern="class", target="files", path="/src",
                    file_glob="*.py", limit=10, offset=5, output_mode="count", context=2)
        mock_ops.search.assert_called_once_with(
            pattern="class", path="/src", target="files", file_glob="*.py",
            limit=10, offset=5, output_mode="count", context=2,
        )

    @patch("tools.file_tools._get_file_ops")
    def test_search_exception_returns_error(self, mock_get):
        mock_get.side_effect = RuntimeError("no terminal")

        from tools.file_tools import search_tool
        result = json.loads(search_tool(pattern="x"))
        assert "error" in result


# ---------------------------------------------------------------------------
# Tool result hint tests (#722)
# ---------------------------------------------------------------------------

class TestPatchHints:
    """Patch tool should hint when old_string is not found."""

    @patch("tools.file_tools._get_file_ops")
    def test_no_match_includes_hint(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {
            "error": "Could not find match for old_string in foo.py"
        }
        mock_ops.patch_replace.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import patch_tool
        raw = patch_tool(mode="replace", path="foo.py", old_string="x", new_string="y")
        assert "[Hint:" in raw
        assert "read_file" in raw

    @patch("tools.file_tools._get_file_ops")
    def test_success_no_hint(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {"success": True, "diff": "--- a\n+++ b"}
        mock_ops.patch_replace.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import patch_tool
        raw = patch_tool(mode="replace", path="foo.py", old_string="x", new_string="y")
        assert "[Hint:" not in raw


class TestSearchHints:
    """Search tool should hint when results are truncated."""

    def setup_method(self):
        """Clear read/search tracker between tests to avoid cross-test state."""
        from tools.file_tools import clear_read_tracker
        clear_read_tracker()

    @patch("tools.file_tools._get_file_ops")
    def test_truncated_results_hint(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {
            "total_count": 100,
            "matches": [{"path": "a.py", "line": 1, "content": "x"}] * 50,
            "truncated": True,
        }
        mock_ops.search.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import search_tool
        raw = search_tool(pattern="foo", offset=0, limit=50)
        assert "[Hint:" in raw
        assert "offset=50" in raw

    @patch("tools.file_tools._get_file_ops")
    def test_non_truncated_no_hint(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {
            "total_count": 3,
            "matches": [{"path": "a.py", "line": 1, "content": "x"}] * 3,
        }
        mock_ops.search.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import search_tool
        raw = search_tool(pattern="foo")
        assert "[Hint:" not in raw

    @patch("tools.file_tools._get_file_ops")
    def test_truncated_hint_with_nonzero_offset(self, mock_get):
        mock_ops = MagicMock()
        result_obj = MagicMock()
        result_obj.to_dict.return_value = {
            "total_count": 150,
            "matches": [{"path": "a.py", "line": 1, "content": "x"}] * 50,
            "truncated": True,
        }
        mock_ops.search.return_value = result_obj
        mock_get.return_value = mock_ops

        from tools.file_tools import search_tool
        raw = search_tool(pattern="foo", offset=50, limit=50)
        assert "[Hint:" in raw
        assert "offset=100" in raw


# ---------------------------------------------------------------------------
# _check_sensitive_read_path — unit + integration tests (T3, PR-B)
# ---------------------------------------------------------------------------


class TestCheckSensitiveReadPath:
    """Parametrized coverage for the credential-directory read guard."""

    @pytest.mark.parametrize("path_str", [
        "~/.ssh/id_rsa",               # exact file match
        "~/.ssh/config",               # exact file match
        "~/.ssh/authorized_keys",      # exact file match
        "~/.netrc",                    # exact file match (top-level dotfile)
        "~/.npmrc",                    # exact file match (top-level dotfile)
        "~/.aws/credentials",          # directory prefix (.aws)
        "~/.aws/config",               # directory prefix (.aws)
        "~/.gnupg/secring.gpg",        # directory prefix (.gnupg)
        "~/.kube/config",              # directory prefix (.kube)
        "~/.docker/config.json",       # directory prefix (.docker)
        "~/.azure/accessTokens.json",  # directory prefix (.azure)
        "~/.config/gh/hosts.yml",      # directory prefix (.config/gh)
        "~/.ssh/custom_key",           # arbitrary file inside .ssh/
        "~/.ssh/subdirectory/id_rsa",  # deep subpath inside .ssh/
    ])
    def test_blocks_sensitive_paths(self, path_str):
        from tools.file_tools import _check_sensitive_read_path
        result = _check_sensitive_read_path(path_str)
        assert result is not None, f"Expected block for {path_str!r}, got None"
        assert "Access denied" in result

    @pytest.mark.parametrize("path_str", [
        "~/projects/myapp/config.py",
        "/tmp/testfile.txt",
        "~/Documents/notes.md",
    ])
    def test_allows_safe_paths(self, path_str):
        from tools.file_tools import _check_sensitive_read_path
        result = _check_sensitive_read_path(path_str)
        assert result is None, f"Expected None (allowed) for {path_str!r}, got {result!r}"

    def test_blocks_symlink_resolving_to_sensitive_path(self, tmp_path):
        """A symlink in a safe directory that resolves to ~/.ssh/id_rsa must be blocked."""
        from tools.file_tools import _check_sensitive_read_path
        target = Path.home() / ".ssh" / "id_rsa"
        link = tmp_path / "fake_key"
        link.symlink_to(target)
        result = _check_sensitive_read_path(str(link))
        assert result is not None, "Symlink pointing to sensitive path must be blocked"
        assert "Access denied" in result

    def test_blocks_relative_path_traversal_to_sensitive_path(self, tmp_path, monkeypatch):
        """A relative '../../.ssh/id_rsa' that resolves into ~/.ssh/ must be blocked."""
        from tools.file_tools import _check_sensitive_read_path
        # Use resolved forms on both sides to avoid macOS /private/... symlink skew.
        ssh_key = Path.home().resolve() / ".ssh" / "id_rsa"
        tmp_resolved = tmp_path.resolve()
        try:
            rel = os.path.relpath(ssh_key, tmp_resolved)
        except ValueError:
            pytest.skip("Cross-drive relative paths not supported on this platform")
        monkeypatch.chdir(tmp_resolved)
        result = _check_sensitive_read_path(rel)
        assert result is not None, f"Relative traversal {rel!r} to sensitive target must be blocked"
        assert "Access denied" in result


class TestReadFileSensitiveGuardIntegration:
    """read_file_tool must return access-denied JSON before touching any I/O."""

    def test_blocks_ssh_private_key(self):
        from tools.file_tools import read_file_tool
        result = json.loads(read_file_tool("~/.ssh/id_rsa"))
        assert "error" in result
        assert "Access denied" in result["error"]

    def test_blocks_aws_credentials(self):
        from tools.file_tools import read_file_tool
        result = json.loads(read_file_tool("~/.aws/credentials"))
        assert "error" in result
        assert "Access denied" in result["error"]

    def test_blocks_docker_config(self):
        from tools.file_tools import read_file_tool
        result = json.loads(read_file_tool("~/.docker/config.json"))
        assert "error" in result
        assert "Access denied" in result["error"]

    def test_blocks_hermes_env_file(self):
        """T4: HERMES_HOME/.env must be blocked (profile-aware via HERMES_HOME env var)."""
        import os
        from tools.file_tools import read_file_tool
        hermes_env = os.path.join(os.environ["HERMES_HOME"], ".env")
        result = json.loads(read_file_tool(hermes_env))
        assert "error" in result
        assert "Access denied" in result["error"]


class TestSearchSensitiveGuardIntegration:
    """search_tool must return access-denied JSON when path points into a credential dir."""

    def test_blocks_ssh_directory(self):
        from tools.file_tools import search_tool
        result = json.loads(search_tool(pattern="KEY", path="~/.ssh/"))
        assert "error" in result
        assert "Access denied" in result["error"]

    def test_blocks_aws_directory(self):
        from tools.file_tools import search_tool
        result = json.loads(search_tool(pattern="token", path="~/.aws/"))
        assert "error" in result
        assert "Access denied" in result["error"]



