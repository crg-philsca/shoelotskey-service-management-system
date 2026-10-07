import pytest
from order_numbering import validate_customer_name, CUSTOMER_NAME_MAX_LENGTH, CUSTOMER_NAME_MIN_LENGTH

def test_valid_customer_names():
    # Single first + last
    ok, err, name = validate_customer_name("Juan Cruz")
    assert ok is True
    assert name == "Juan Cruz"

    # First name + Second name + Middle name + Last name
    ok, err, name = validate_customer_name("Juan Carlos Rodriguez Dela Cruz")
    assert ok is True
    assert name == "Juan Carlos Rodriguez Dela Cruz"

    # With middle initial and dot
    ok, err, name = validate_customer_name("Maria C. Santos")
    assert ok is True
    assert name == "Maria C. Santos"

    # With hyphenated name
    ok, err, name = validate_customer_name("Mary-Ann Dela-Cruz")
    assert ok is True
    assert name == "Mary-Ann Dela-Cruz"

    # With apostrophe
    ok, err, name = validate_customer_name("Mark D'Angelo O'Connor")
    assert ok is True
    assert name == "Mark D'Angelo O'Connor"

    # With Philippine ñ
    ok, err, name = validate_customer_name("Niño Peña")
    assert ok is True
    assert name == "Niño Peña"

def test_customer_name_length_limit():
    # Exactly 60 characters
    exact_60 = "A" * 30 + " " + "B" * 29
    assert len(exact_60) == 60
    ok, err, name = validate_customer_name(exact_60)
    assert ok is True
    assert len(name) <= 60

    # Over 60 characters
    over_60 = "Juan Carlos Rodriguez Dela Cruz Ferdinand Marcos Romualdez Santos Junior"
    assert len(over_60) > 60
    ok, err, name = validate_customer_name(over_60)
    assert ok is False
    assert f"cannot exceed {CUSTOMER_NAME_MAX_LENGTH}" in err

    # Too short
    ok, err, name = validate_customer_name("J")
    assert ok is False
    assert f"at least {CUSTOMER_NAME_MIN_LENGTH}" in err

    # Empty
    ok, err, name = validate_customer_name("   ")
    assert ok is False
    assert "required" in err

def test_invalid_characters():
    # Numbers not allowed
    ok, err, name = validate_customer_name("John Doe 123")
    assert ok is False

    # Special symbols not allowed
    ok, err, name = validate_customer_name("Jane <script>")
    assert ok is False

    # Punctuation only
    ok, err, name = validate_customer_name(".-.")
    assert ok is False

def test_cyber_attack_and_script_injection():
    from schemas import sanitize_security_string

    # Script tags should be blocked
    with pytest.raises(ValueError, match="Script tags and executable JavaScript"):
        sanitize_security_string("<script>alert('xss')</script>")

    with pytest.raises(ValueError, match="Script tags and executable JavaScript"):
        sanitize_security_string("<script src='malicious.js'>")

    with pytest.raises(ValueError, match="Script tags and executable JavaScript"):
        sanitize_security_string("javascript:alert(1)")

    # SQL injection should be blocked
    with pytest.raises(ValueError, match="Database manipulation and SQL injection"):
        sanitize_security_string("Nike' UNION SELECT * FROM users--")

    with pytest.raises(ValueError, match="Database manipulation and SQL injection"):
        sanitize_security_string("'; DROP TABLE orders; --")

    # Safe strings should be cleanly preserved and HTML brackets neutralized
    assert sanitize_security_string("Air Jordan 1") == "Air Jordan 1"
    assert sanitize_security_string("Running / Training") == "Running / Training"
    assert sanitize_security_string("Size 10.5 (US)") == "Size 10.5 (US)"
